import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchNigerianBanks, resolveNubanAccount } from "@/lib/banking.server";

/** Authenticated: list Nigerian banks from Paystack. */
export const listNigerianBanks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ banks: await fetchNigerianBanks() }));

const resolveSchema = z.object({
  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
  bankCode: z.string().min(2).max(10),
});

/** Authenticated: resolve an account number to its registered account name. */
export const resolveBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => resolveSchema.parse(data))
  .handler(async ({ data }) => resolveNubanAccount(data.accountNumber, data.bankCode));

/** Name shown on the request when Paystack could not confirm it automatically. */

const withdrawSchema = z.object({
  amount: z.number().positive().max(100_000_000),
  bankCode: z.string().min(2).max(10),
  bankName: z.string().min(2).max(80),
  accountNumber: z.string().regex(/^\d{10}$/),
  accountName: z.string().min(2).max(120).optional(),
  note: z.string().max(200).optional(),
  saveMethod: z.boolean().optional(),
  /** Client-generated key so retries/double submits never create two requests. */
  idempotencyKey: z.string().min(6).max(60).optional(),
});

/**
 * Authenticated: validate the destination account, debit the wallet atomically
 * (never below zero) and record the withdrawal request + notifications.
 */
export const submitWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => withdrawSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Idempotency: the same key always maps to the same request row.
    const reference = data.idempotencyKey
      ? `wd_${data.idempotencyKey}`.slice(0, 80)
      : `wd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { data: alreadyExists } = await supabase
      .from("withdrawal_requests")
      .select("id, reference, amount")
      .eq("user_id", userId)
      .eq("reference", reference)
      .maybeSingle();
    if (alreadyExists) {
      const { data: currentWallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .eq("currency", "NGN")
        .maybeSingle();
      return {
        ok: true,
        duplicate: true,
        reference: alreadyExists.reference,
        accountName: data.accountName ?? "",
        newBalance: Number(currentWallet?.balance ?? 0),
      };
    }

    // Re-verify the destination server-side so a tampered client can't fake it.
    // If Paystack cannot resolve names on this account, fall back to the name
    // the user confirmed instead of blocking the withdrawal.
    const resolution = await resolveNubanAccount(data.accountNumber, data.bankCode);
    if (!resolution.verified && !resolution.unavailable) throw new Error(resolution.reason);
    const accountName = resolution.verified
      ? resolution.accountName
      : (data.accountName ?? "").trim();
    if (!accountName) throw new Error("Enter the account name for this bank account");
    const resolved = { accountName };

    const { data: wallet, error: walletErr } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .eq("currency", "NGN")
      .maybeSingle();
    if (walletErr) throw new Error(walletErr.message);
    if (!wallet) throw new Error("Wallet not found");
    if (Number(wallet.balance) < data.amount) throw new Error("Amount exceeds your wallet balance");

    let methodId: string | null = null;
    const { data: existing } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("user_id", userId)
      .eq("method_type", "bank")
      .eq("account_number", data.accountNumber)
      .eq("bank_name", data.bankName)
      .maybeSingle();
    if (existing) {
      methodId = existing.id;
    } else if (data.saveMethod) {
      const { data: created } = await supabase
        .from("payment_methods")
        .insert({
          user_id: userId,
          method_type: "bank",
          label: `${data.bankName} · ${data.accountNumber.slice(-4)}`,
          bank_name: data.bankName,
          account_number: data.accountNumber,
          account_name: resolved.accountName,
        })
        .select("id")
        .maybeSingle();
      methodId = created?.id ?? null;
    }

    // Conditional debit: fails if another request drained the balance first.
    const { data: debited, error: debitErr } = await supabase
      .from("wallets")
      .update({
        balance: Number(wallet.balance) - data.amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id)
      .gte("balance", data.amount)
      .select("id, balance")
      .maybeSingle();
    if (debitErr) throw new Error(debitErr.message);
    if (!debited) throw new Error("Balance changed — please try again");

    const noteLine = [
      `${data.bankName} · ${data.accountNumber} · ${resolved.accountName}`,
      data.note,
    ]
      .filter(Boolean)
      .join(" — ");

    const { data: created, error: reqErr } = await supabase
      .from("withdrawal_requests")
      .insert({
        user_id: userId,
        amount: data.amount,
        currency: "NGN",
        payment_method_id: methodId,
        note: noteLine.slice(0, 400),
        reference,
      })
      .select("id, reference")
      .maybeSingle();
    if (reqErr) {
      // Roll the debit back so funds are never lost on a failed insert.
      await supabase
        .from("wallets")
        .update({ balance: Number(wallet.balance), updated_at: new Date().toISOString() })
        .eq("id", wallet.id);
      throw new Error(reqErr.message);
    }

    const naira = `₦${data.amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Withdrawal submitted",
      body: `Your withdrawal of ${naira} to ${resolved.accountName} (${data.bankName}) is under review.`,
      category: "withdrawal",
    });

    // Notify staff — needs elevated access, so load the admin client here.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: staff } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "super_admin", "finance"]);
      const ids = [...new Set((staff ?? []).map((s) => s.user_id))];
      if (ids.length) {
        await supabaseAdmin.from("notifications").insert(
          ids.map((id) => ({
            user_id: id,
            title: "New withdrawal request",
            body: `${naira} requested to ${data.bankName} (${data.accountNumber}). Ref ${reference}.`,
            category: "withdrawal",
          })),
        );
      }
    } catch {
      /* admin notification must never block the user's request */
    }

    return {
      ok: true,
      duplicate: false,
      reference: created?.reference ?? reference,
      accountName: resolved.accountName,
      newBalance: Number(debited.balance),
    };
  });
