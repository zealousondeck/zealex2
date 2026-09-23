import { createFileRoute } from "@tanstack/react-router";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const secret = (process.env["PAYSTACK_SECRET_KEY"] ?? "").replace(/\s+/g, "");
          if (!secret || secret.startsWith("pk_")) {
            console.error("[Paystack webhook] missing or invalid PAYSTACK_SECRET_KEY");
            return new Response("Server misconfigured", { status: 500 });
          }

          const headerSignature = request.headers.get("x-paystack-signature") ?? "";
          if (!headerSignature) {
            console.error("[Paystack webhook] missing x-paystack-signature header");
            return new Response("Missing signature", { status: 400 });
          }

          const rawBody = await request.text();
          if (!rawBody) {
            console.error("[Paystack webhook] empty request body");
            return new Response("Empty payload", { status: 400 });
          }

          const crypto = await import("node:crypto");
          const computedSignature = crypto
            .createHmac("sha512", secret)
            .update(rawBody)
            .digest("hex");

          const headerBuffer = Buffer.from(headerSignature, "utf8");
          const computedBuffer = Buffer.from(computedSignature, "utf8");
          if (
            headerBuffer.length !== computedBuffer.length ||
            !crypto.timingSafeEqual(headerBuffer, computedBuffer)
          ) {
            console.error("[Paystack webhook] invalid signature");
            return new Response("Invalid signature", { status: 400 });
          }

          let payload: {
            event?: unknown;
            data?: Record<string, unknown> & { metadata?: { user_id?: unknown } };
          };
          try {
            payload = JSON.parse(rawBody);
          } catch (error) {
            console.error("[Paystack webhook] invalid JSON payload", error);
            return new Response("Malformed JSON", { status: 400 });
          }

          const data = payload?.data;

          if (!data || typeof data !== "object") {
            console.error("[Paystack webhook] missing payload.data");
            return new Response("Malformed payload", { status: 400 });
          }

          const reference = String(data.reference ?? "").trim();
          if (!reference) {
            console.error("[Paystack webhook] missing reference");
            return new Response("Missing reference", { status: 400 });
          }

          let verificationResponse: Response;
          try {
            verificationResponse = await fetch(
              `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
              { headers: { Authorization: `Bearer ${secret}` } },
            );
          } catch (error) {
            console.error("[Paystack webhook] provider verification request failed", {
              reference,
              error,
            });
            return new Response("Paystack verification temporarily unavailable", { status: 503 });
          }

          const verificationPayload = (await verificationResponse.json().catch(() => null)) as {
            status?: boolean;
            message?: string;
            data?: { status?: string; amount?: number; currency?: string };
          } | null;

          if (
            !verificationResponse.ok ||
            !verificationPayload?.status ||
            !verificationPayload.data
          ) {
            console.error("[Paystack webhook] provider verification failed", {
              reference,
              status: verificationResponse.status,
              message: verificationPayload?.message,
            });
            return new Response("Paystack verification temporarily unavailable", { status: 503 });
          }

          const verifiedTransaction = verificationPayload.data;
          const txStatus = String(verifiedTransaction.status ?? "").toLowerCase();
          if (txStatus !== "success") {
            console.error(
              `[Paystack webhook] verified payment is not successful for ${reference}: ${txStatus}`,
            );
            return new Response(JSON.stringify({ ok: true, handled: false, status: txStatus }), {
              status: 200,
            });
          }

          const currency = String(verifiedTransaction.currency ?? "")
            .trim()
            .toUpperCase();
          if (!currency) {
            console.error(`[Paystack webhook] missing currency for ${reference}`);
            return new Response("Missing currency", { status: 400 });
          }
          if (currency !== "NGN") {
            console.error(`[Paystack webhook] unsupported currency ${currency} for ${reference}`);
            return new Response("Unsupported currency", { status: 400 });
          }

          const amountKobo = Number(verifiedTransaction.amount ?? 0);
          if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
            console.error(
              `[Paystack webhook] invalid verified amount for ${reference}: ${verifiedTransaction.amount}`,
            );
            return new Response("Invalid amount", { status: 400 });
          }

          const nairaAmount = amountKobo / 100;
          if (!(nairaAmount > 0)) {
            console.error(
              `[Paystack webhook] zero or negative amount for ${reference}: ${amountKobo}`,
            );
            return new Response("Invalid amount", { status: 400 });
          }

          let userId: string | null = null;
          const metadataUserId = data?.metadata?.user_id;
          if (metadataUserId !== undefined && metadataUserId !== null && metadataUserId !== "") {
            userId = String(metadataUserId).trim();
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (!userId) {
            try {
              const { data: existingDeposit, error: lookupError } = await supabaseAdmin
                .from("deposit_requests")
                .select("user_id")
                .eq("reference", reference)
                .maybeSingle();

              if (lookupError) {
                throw lookupError;
              }

              if (existingDeposit?.user_id) {
                userId = String(existingDeposit.user_id).trim();
              }
            } catch (lookupError) {
              console.error(
                "[Paystack webhook] failed to resolve deposit user mapping",
                lookupError,
              );
              return new Response("Server error", { status: 500 });
            }
          }

          if (!userId || !uuidRegex.test(userId)) {
            console.error(
              `[Paystack webhook] missing or invalid user_id for reference ${reference}: ${userId ?? "none"}`,
            );
            return new Response("Invalid user mapping", { status: 400 });
          }

          try {
            const { data: profile, error: profileError } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("id", userId)
              .maybeSingle();

            if (profileError) {
              throw profileError;
            }
            if (!profile?.id) {
              console.error(
                `[Paystack webhook] user does not exist for id ${userId}, reference ${reference}`,
              );
              return new Response("User not found", { status: 400 });
            }
          } catch (profileError) {
            console.error("[Paystack webhook] user validation failed", profileError);
            return new Response("Server error", { status: 500 });
          }

          try {
            const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
              "paystack_credit_deposit",
              {
                _user_id: userId,
                _amount: nairaAmount,
                _reference: reference,
              },
            );

            if (rpcError) {
              console.error("[Paystack webhook] paystack_credit_deposit RPC failed", {
                code: rpcError.code,
                message: rpcError.message,
                details: rpcError.details,
                hint: rpcError.hint,
                reference,
              });
              return new Response("Wallet credit temporarily failed", { status: 500 });
            }

            const duplicate =
              typeof rpcResult === "object" && rpcResult !== null && "duplicate" in rpcResult
                ? Boolean((rpcResult as { duplicate?: boolean }).duplicate)
                : false;

            return new Response(
              JSON.stringify({ ok: true, duplicate, result: rpcResult ?? null }),
              {
                status: 200,
              },
            );
          } catch (error) {
            console.error("[Paystack webhook] unexpected server error during wallet credit", error);
            return new Response("Server error", { status: 500 });
          }
        } catch (error) {
          console.error("[Paystack webhook] unhandled handler error", error);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});
