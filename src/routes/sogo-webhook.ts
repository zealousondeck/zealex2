import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sogoRequest } from "@/lib/sogo/client";

type SogoEventName =
  | "transaction.completed"
  | "transaction.failed"
  | "transaction.refunded"
  | "transaction.cancelled";

type SogoWebhook = {
  id: string;
  event: SogoEventName;
  api_version: string;
  created: number;
  livemode: boolean;
  data: {
    object?: "transaction" | "transaction_refund";
    id?: string;
    reference?: string;
    transaction_reference?: string;
    transaction_id?: string;
    provider_transaction_id?: string;
    transaction_status?: string;
    status?: string;
    amount?: number;
    net_amount?: number;
    original_amount?: number;
    refunded_amount?: number;
    currency?: string;
  };
};

type SogoTransactionLookup = {
  status?: string | { value?: string };
  amount?: number | { raw?: number; currency?: string };
};

const eventNames: SogoEventName[] = [
  "transaction.completed",
  "transaction.failed",
  "transaction.refunded",
  "transaction.cancelled",
];

function normalizeSogoStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function parseReference(data: Record<string, unknown>): string | undefined {
  const values = [
    data.reference,
    data.transaction_reference,
    data.id,
    data.transaction_id,
    data.transactionId,
    data.refund_id,
    data.provider_transaction_id,
    data.providerTransactionId,
  ];

  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function parseStatus(data: Record<string, unknown>): string | undefined {
  const values = [data.status, data.transaction_status, data.state, data.transactionState];
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function parseAmount(data: Record<string, unknown>): number | undefined {
  const candidates = [data.amount, data.net_amount, data.original_amount, data.refunded_amount];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function parseProviderTransactionId(data: Record<string, unknown>): string | undefined {
  const values = [data.provider_transaction_id, data.providerTransactionId, data.transaction_id, data.transactionId, data.id];
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function isWebhook(value: unknown): value is SogoWebhook {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<SogoWebhook>;
  return (
    typeof event.id === "string" &&
    typeof event.api_version === "string" &&
    typeof event.created === "number" &&
    typeof event.livemode === "boolean" &&
    typeof event.event === "string" &&
    eventNames.includes(event.event as SogoEventName) &&
    Boolean(event.data && typeof event.data === "object")
  );
}

export const Route = createFileRoute("/sogo-webhook")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            route: "/sogo-webhook",
            acceptable_events: eventNames,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      POST: async ({ request }) => {
        const rawBody = await request.text();
        if (!rawBody.trim()) return new Response("Empty payload", { status: 400 });

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Malformed JSON", { status: 400 });
        }
        if (!isWebhook(payload)) return new Response("Malformed Sogo event", { status: 400 });

        const data = payload.data as Record<string, unknown>;
        const reference = parseReference(data);
        const providerTransactionId = parseProviderTransactionId(data);
        const status = parseStatus(data);
        if (!reference || !status) return new Response("Missing transaction reference or status", { status: 400 });

        const normalizedStatus = normalizeSogoStatus(status);
        const eventName = normalizeSogoStatus(payload.event);
        const blockedStatuses = new Set(["pending", "processing", "failed", "cancelled", "refunded", "reversed", "error", "expired"]);

        if (blockedStatuses.has(normalizedStatus)) {
          return new Response(
            JSON.stringify({ ok: true, handled: false, event: eventName, status: normalizedStatus, reference }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        let verifiedStatus = "";
        let amount = parseAmount(data);
        let currency = typeof data.currency === "string" ? data.currency.trim().toUpperCase() : "";

        if (eventName === "transaction.completed") {
          try {
            const transaction = await sogoRequest<SogoTransactionLookup>(`/transactions/${encodeURIComponent(reference)}`);
            const verified = transaction?.status;
            verifiedStatus = typeof verified === "object" ? String(verified.value ?? "") : String(verified ?? "");
            const verifiedAmount = transaction?.amount;
            amount =
              typeof verifiedAmount === "object"
                ? Number(verifiedAmount.raw ?? amount ?? 0)
                : Number(verifiedAmount ?? amount ?? 0);
            if (typeof verifiedAmount === "object" && typeof verifiedAmount.currency === "string") {
              currency = verifiedAmount.currency.trim().toUpperCase();
            }
          } catch (error) {
            console.warn("[Sogo webhook] provider lookup unavailable", {
              eventId: payload.id,
              reference,
              eventName,
              error: error instanceof Error ? error.message : String(error),
            });
            return new Response(
              JSON.stringify({
                ok: false,
                retry: true,
                reason: "provider_verification_failed",
                event_id: payload.id,
                reference,
                event: eventName,
              }),
              { status: 503, headers: { "content-type": "application/json" } },
            );
          }
        }

        const finalVerifiedStatus = normalizeSogoStatus(verifiedStatus);
        if (finalVerifiedStatus !== "completed") {
          return new Response(
            JSON.stringify({ ok: true, handled: false, event: eventName, status: normalizedStatus, verified_status: finalVerifiedStatus, reference }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        const { data: result, error } = await (supabaseAdmin as any).rpc("reconcile_sogo_transaction", {
          _event_id: payload.id,
          _provider_reference: reference,
          _provider_transaction_id: providerTransactionId ?? null,
          _provider_status: normalizedStatus,
          _verified_status: finalVerifiedStatus,
          _amount: Number.isFinite(amount) ? Number(amount) : null,
          _currency: currency,
        });
        if (error) {
          console.error("[Sogo webhook] reconciliation failed", {
            eventId: payload.id,
            reference,
            eventName,
            providerStatus: normalizedStatus,
            verifiedStatus: finalVerifiedStatus,
            code: error.code,
            message: error.message,
          });
          return new Response(
            JSON.stringify({ ok: false, reason: "reconciliation_failed", event_id: payload.id, reference, event: eventName }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(JSON.stringify(result ?? { ok: true, event_id: payload.id, event: eventName, reference }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
