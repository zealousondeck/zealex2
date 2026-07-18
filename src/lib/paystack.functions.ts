import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public: expose the Paystack publishable key to the browser. */
export const getPaystackPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.PAYSTACK_PUBLIC_KEY;
  if (!key) throw new Error("Paystack is not configured");
  return { publicKey: key };
});

const verifySchema = z.object({
  reference: z.string().min(6).max(100),
  expectedAmount: z.number().positive(),
});

/** Authenticated: verify a Paystack reference and atomically credit the wallet. */
export const verifyPaystackPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => verifySchema.parse(data))
  .handler(async ({ data, context }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Paystack is not configured");

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    if (!res.ok) throw new Error("Could not verify payment with Paystack");
    const payload = (await res.json()) as {
      status: boolean;
      data?: { status: string; amount: number; currency: string };
    };
    const tx = payload.data;
    if (!payload.status || !tx || tx.status !== "success") {
      throw new Error("Payment was not successful");
    }
    // Paystack returns amount in kobo
    const nairaAmount = tx.amount / 100;
    if (Math.abs(nairaAmount - data.expectedAmount) > 0.01) {
      throw new Error("Amount mismatch");
    }
    if (tx.currency && tx.currency !== "NGN") {
      throw new Error("Unsupported currency");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rpc, error } = await supabaseAdmin.rpc("paystack_credit_deposit", {
      _user_id: context.userId,
      _amount: nairaAmount,
      _reference: data.reference,
    });
    if (error) throw new Error(error.message);
    return {
      ok: true,
      duplicate: (rpc as { duplicate?: boolean } | null)?.duplicate ?? false,
      amount: nairaAmount,
    };
  });
