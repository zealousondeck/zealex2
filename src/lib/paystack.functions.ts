import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public: expose the Paystack publishable key to the browser. */
export const getPaystackPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = (process.env["PAYSTACK_PUBLIC_KEY"] ?? "").replace(/\s+/g, "");
  if (!key) throw new Error("Paystack is not configured");
  return { publicKey: key };
});

const verifySchema = z.object({
  reference: z.string().min(6).max(100),
  expectedAmount: z.number().positive(),
});

/** Error thrown by verification with a machine-readable code the UI can act on. */
class VerifyError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** Authenticated: verify a Paystack reference and atomically credit the wallet. */
export const verifyPaystackPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => verifySchema.parse(data))
  .handler(async ({ data, context }) => {
    const secret = (process.env["PAYSTACK_SECRET_KEY"] ?? "").replace(/\s+/g, "");
    if (!secret || secret.startsWith("pk_")) {
      throw new VerifyError("Payments are misconfigured on the server", false);
    }

    // If this reference was already credited, return the stored result without
    // ever touching Paystack or the wallet again.
    const { data: existing } = await context.supabase
      .from("deposit_requests")
      .select("id, amount, status")
      .eq("user_id", context.userId)
      .eq("reference", data.reference)
      .maybeSingle();
    if (existing) {
      return { ok: true, duplicate: true, amount: Number(existing.amount) };
    }

    let res: Response;
    try {
      res = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
        { headers: { Authorization: `Bearer ${secret}` } },
      );
    } catch {
      throw new VerifyError("Could not reach Paystack — retrying shortly", true);
    }

    const payload = (await res.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: { status: string; amount: number; currency: string };
    } | null;

    if (res.status === 404) {
      throw new VerifyError("Paystack has not registered this payment yet", true);
    }
    if (res.status === 401 || res.status === 403) {
      throw new VerifyError("Payments are misconfigured on the server", false);
    }
    if (!res.ok || !payload?.status || !payload.data) {
      throw new VerifyError(payload?.message || "Verification temporarily failed", true);
    }

    const tx = payload.data;
    if (tx.status === "ongoing" || tx.status === "pending") {
      throw new VerifyError("Your payment is still being processed", true);
    }
    if (tx.status === "abandoned") {
      throw new VerifyError("This payment was not completed", false);
    }
    if (tx.status !== "success") {
      throw new VerifyError("Paystack declined this payment", false);
    }
    if (tx.currency && tx.currency !== "NGN") {
      throw new VerifyError("Only Naira payments are supported", false);
    }

    // Credit exactly what Paystack settled (kobo → naira), never the client's claim.
    const nairaAmount = tx.amount / 100;
    if (!(nairaAmount > 0)) throw new VerifyError("Paystack reported a zero payment", false);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rpc, error } = await supabaseAdmin.rpc("paystack_credit_deposit", {
      _user_id: context.userId,
      _amount: nairaAmount,
      _reference: data.reference,
    });
    if (error) throw new VerifyError("Could not credit your wallet — please retry", true);
    return {
      ok: true,
      duplicate: (rpc as { duplicate?: boolean } | null)?.duplicate ?? false,
      amount: nairaAmount,
    };
  });

