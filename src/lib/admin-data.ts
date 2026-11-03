import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAudit } from "./audit";

export type AdminProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  referral_code: string | null;
  account_status: string;
  created_at: string;
};

export type AdminWallet = {
  id: string;
  user_id: string;
  currency: string;
  balance: number;
  updated_at: string;
};

export type AdminTx = {
  id: string;
  user_id: string;
  type: string;
  category: string;
  asset: string;
  amount: number;
  quantity: number | null;
  status: string;
  stage: string;
  reference: string;
  created_at: string;
};

export type AdminDeposit = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method_id: string | null;
  proof_path: string | null;
  note: string | null;
  stage: string;
  status: string;
  reference: string;
  created_at: string;
};

export type AdminWithdrawal = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method_id: string | null;
  note: string | null;
  stage: string;
  status: string;
  reference: string;
  created_at: string;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  transfer_recipient_code: string | null;
  transfer_code: string | null;
  transfer_reference: string | null;
};

/** Aggregate admin dashboard stats. */
export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const [
        users,
        activeUsers,
        pendingKyc,
        approvedKyc,
        pendingDeposits,
        pendingWithdrawals,
        pendingCrypto,
        pendingGift,
        completedTx,
        volume,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("account_status", "active"),
        supabase
          .from("kyc_submissions")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("kyc_submissions")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved"),
        supabase
          .from("deposit_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("withdrawal_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("category", "crypto")
          .eq("status", "pending"),
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("category", "giftcard")
          .eq("status", "pending"),
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed"),
        supabase.from("transactions").select("amount, category, status"),
      ]);

      const rows = (volume.data ?? []) as { amount: number; category: string; status: string }[];
      const totalVolume = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
      const totalRevenue = rows
        .filter((r) => r.status === "completed")
        .reduce((s, r) => s + Number(r.amount || 0) * 0.02, 0); // 2% assumed spread
      const cryptoVolume = rows
        .filter((r) => r.category === "crypto")
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      const giftVolume = rows
        .filter((r) => r.category === "giftcard")
        .reduce((s, r) => s + Number(r.amount || 0), 0);

      return {
        totalUsers: users.count ?? 0,
        activeUsers: activeUsers.count ?? 0,
        pendingKyc: pendingKyc.count ?? 0,
        approvedKyc: approvedKyc.count ?? 0,
        pendingDeposits: pendingDeposits.count ?? 0,
        pendingWithdrawals: pendingWithdrawals.count ?? 0,
        pendingCrypto: pendingCrypto.count ?? 0,
        pendingGift: pendingGift.count ?? 0,
        completedTx: completedTx.count ?? 0,
        totalVolume,
        totalRevenue,
        cryptoVolume,
        giftVolume,
      };
    },
    refetchInterval: 30_000,
  });
}

/** Daily transactions grouped for chart, last 14 days. */
export function useDailyTxSeries() {
  return useQuery({
    queryKey: ["admin", "daily-tx"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 13);
      const { data } = await supabase
        .from("transactions")
        .select("amount, created_at, category")
        .gte("created_at", since.toISOString());
      const buckets: Record<string, { date: string; volume: number; count: number }> = {};
      for (let i = 0; i < 14; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = { date: key.slice(5), volume: 0, count: 0 };
      }
      for (const r of (data ?? []) as { amount: number; created_at: string }[]) {
        const key = r.created_at.slice(0, 10);
        if (buckets[key]) {
          buckets[key].volume += Number(r.amount || 0);
          buckets[key].count += 1;
        }
      }
      return Object.values(buckets);
    },
  });
}

export function useAdminUsers(search: string) {
  return useQuery({
    queryKey: ["admin", "users", search],
    queryFn: async (): Promise<AdminProfile[]> => {
      let q = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (search) {
        q = q.or(
          `full_name.ilike.%${search}%,email.ilike.%${search}%,referral_code.ilike.%${search}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AdminProfile[];
    },
  });
}

export function useAdminDeposits(status: string) {
  return useQuery({
    queryKey: ["admin", "deposits", status],
    queryFn: async (): Promise<AdminDeposit[]> => {
      let q = supabase
        .from("deposit_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AdminDeposit[];
    },
  });
}

export function useAdminWithdrawals(status: string) {
  return useQuery({
    queryKey: ["admin", "withdrawals", status],
    queryFn: async (): Promise<AdminWithdrawal[]> => {
      let q = supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AdminWithdrawal[];
    },
  });
}

export function useAdminTransactions(filters: { status: string; category: string }) {
  return useQuery({
    queryKey: ["admin", "transactions", filters],
    queryFn: async (): Promise<AdminTx[]> => {
      let q = supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (filters.status !== "all") q = q.eq("status", filters.status);
      if (filters.category !== "all") q = q.eq("category", filters.category);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AdminTx[];
    },
  });
}

export function useAdminWallets(search: string) {
  return useQuery({
    queryKey: ["admin", "wallets", search],
    queryFn: async () => {
      const { data: wallets, error } = await supabase
        .from("wallets")
        .select("*")
        .order("balance", { ascending: false })
        .limit(200);
      if (error) throw error;
      let list = (wallets ?? []) as AdminWallet[];
      const uids = Array.from(new Set(list.map((w) => w.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", uids);
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      let out = list.map((w) => ({ ...w, profile: pmap.get(w.user_id) as any }));
      if (search) {
        const s = search.toLowerCase();
        out = out.filter(
          (w) =>
            (w.profile?.full_name ?? "").toLowerCase().includes(s) ||
            (w.profile?.email ?? "").toLowerCase().includes(s),
        );
      }
      return out;
    },
  });
}

export function useUpdateDepositStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      stage,
      note,
      userId,
      amount,
    }: {
      id: string;
      status: "approved" | "rejected" | "pending";
      stage: string;
      note?: string;
      userId: string;
      amount: number;
    }) => {
      const patch: any = { status, stage };
      if (note) patch.note = note;
      const { error } = await supabase.from("deposit_requests").update(patch).eq("id", id);
      if (error) throw error;

      if (status === "approved") {
        // Credit wallet
        const { data: w } = await supabase
          .from("wallets")
          .select("id, balance")
          .eq("user_id", userId)
          .eq("currency", "NGN")
          .maybeSingle();
        if (w) {
          await supabase
            .from("wallets")
            .update({ balance: Number(w.balance) + Number(amount) })
            .eq("id", w.id);
        }
      }
      await supabase.from("notifications").insert({
        user_id: userId,
        title:
          status === "approved"
            ? "Deposit approved"
            : status === "rejected"
              ? "Deposit rejected"
              : "Deposit updated",
        body:
          status === "approved"
            ? `Your deposit of ₦${amount.toLocaleString()} has been approved and credited.`
            : `Your deposit of ₦${amount.toLocaleString()} was ${status}.${note ? " Note: " + note : ""}`,
        category: "deposit",
      });
      await logAudit("deposit." + status, "deposit_requests", id, { amount, note });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

const updateWithdrawalStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected", "paid"]),
  note: z.string().max(400).optional(),
});

/** Loads the withdrawal's payout destination: snapshot columns, then the saved payment method. */
async function loadPayoutDestination(
  supabaseAdmin: NonNullable<Awaited<ReturnType<typeof importClient>>>,
  wd: {
    bank_name: string | null;
    account_number: string | null;
    account_name: string | null;
    payment_method_id: string | null;
    note: string | null;
  },
): Promise<{ bankName: string; accountNumber: string; accountName: string } | null> {
  if (wd.bank_name && wd.account_number) {
    return {
      bankName: wd.bank_name,
      accountNumber: wd.account_number,
      accountName: wd.account_name ?? "",
    };
  }
  if (wd.payment_method_id) {
    const { data: pm } = await supabaseAdmin
      .from("payment_methods")
      .select("bank_name, account_number, account_name")
      .eq("id", wd.payment_method_id)
      .maybeSingle();
    if (pm?.bank_name && pm.account_number) {
      return {
        bankName: pm.bank_name,
        accountNumber: pm.account_number,
        accountName: pm.account_name ?? "",
      };
    }
  }
  // Older requests kept the destination inside the user note:
  // "Bank · account number · account name".
  const parts = (wd.note ?? "").split("·").map((p) => p.trim());
  if (parts.length >= 3 && /^\d{10}$/.test(parts[1] ?? "")) {
    return { bankName: parts[0], accountNumber: parts[1], accountName: parts[2] };
  }
  return null;
}

/** Atomically debits the user's NGN wallet, or throws without changing anything. */
async function debitWallet(
  supabaseAdmin: NonNullable<Awaited<ReturnType<typeof importClient>>>,
  userId: string,
  amount: number,
): Promise<void> {
  const { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("id, balance")
    .eq("user_id", userId)
    .eq("currency", "NGN")
    .maybeSingle();
  if (!wallet) throw new Error("User has no NGN wallet");
  if (Number(wallet.balance) < amount) {
    throw new Error(
      `Wallet balance (${Number(wallet.balance).toLocaleString()}) is lower than the request amount`,
    );
  }
  const { data: updated, error } = await supabaseAdmin
    .from("wallets")
    .update({ balance: Number(wallet.balance) - amount })
    .eq("id", wallet.id)
    .gte("balance", amount)
    .select("id")
    .maybeSingle();
  if (error || !updated) throw new Error("Could not debit the wallet — please retry");
}

/** Puts a mistaken debit back on the user's wallet. */
async function refundWallet(
  supabaseAdmin: NonNullable<Awaited<ReturnType<typeof importClient>>>,
  userId: string,
  amount: number,
): Promise<void> {
  const { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("id, balance")
    .eq("user_id", userId)
    .eq("currency", "NGN")
    .maybeSingle();
  if (!wallet) return;
  await supabaseAdmin
    .from("wallets")
    .update({ balance: Number(wallet.balance) + amount })
    .eq("id", wallet.id);
}

async function importClient() {
  return import("@/integrations/supabase/client.server");
}

export const updateWithdrawalStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => updateWithdrawalStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const roles = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (roles.error) throw new Error("Unable to verify administrator role");
    const isAdmin = (roles.data ?? []).some((row) =>
      ["admin", "super_admin", "finance"].includes(String((row as { role?: string }).role ?? "")),
    );
    if (!isAdmin) throw new Error("Unauthorized: admin privileges required");

    const { supabaseAdmin } = await importClient();
    const { data: wd } = await supabaseAdmin
      .from("withdrawal_requests")
      .select(
        "id, user_id, amount, currency, status, stage, reference, note, payment_method_id, bank_name, account_number, account_name, transfer_recipient_code, transfer_code, transfer_reference",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!wd) throw new Error("Withdrawal request not found");
    const amount = Number(wd.amount);
    const destination = await loadPayoutDestination(supabaseAdmin, wd as never);
    const naira = `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
    const alreadyHasTransfer = Boolean(wd.transfer_code);

    if (data.status === wd.status) {
      return { ok: true, duplicate: true, status: wd.status, amount };
    }

    if (data.status === "rejected") {
      if (wd.status === "paid") throw new Error("This withdrawal was already paid — it cannot be rejected");
      await supabaseAdmin
        .from("withdrawal_requests")
        .update({ status: "rejected", stage: "rejected" })
        .eq("id", wd.id);
      await supabaseAdmin.from("notifications").insert({
        user_id: wd.user_id,
        title: "Withdrawal rejected",
        body: `${naira} was not approved. Reason: ${data.note?.trim() || "Contact support for details"}.`,
        category: "withdrawal",
      });
      await logAudit("withdrawal.rejected", "withdrawal_requests", wd.id, { note: data.note ?? null });
      return { ok: true, duplicate: false, status: "rejected", amount };
    }

    if (data.status === "approved") {
      if (wd.status === "paid") return { ok: true, duplicate: true, status: "paid", amount };
      if (alreadyHasTransfer) {
        // Idempotent: the transfer was already initiated in a previous click.
        return { ok: true, duplicate: true, status: wd.status, amount };
      }
      if (!destination) throw new Error("No bank destination saved on this request");
      const accountName = destination.accountName?.trim();
      if (!accountName) throw new Error("The destination account name is missing — ask the user to resubmit");

      // 1) Debit the wallet first so money can never move twice.
      await debitWallet(supabaseAdmin, wd.user_id, amount);

      let outcome;
      try {
        // 2) Register the recipient with Paystack.
        const { resolveBankCode, createRecipient } = await import("@/lib/paystack-transfers.server");
        const bankCode = await resolveBankCode(destination.bankName);
        if (!bankCode) {
          throw new Error(`Could not match "${destination.bankName}" to a Paystack bank — check the saved account`);
        }
        const recipientCode = await createRecipient({
          accountName,
          accountNumber: destination.accountNumber,
          bankCode,
        });

        // 3) Send the real transfer.
        const { initiateTransfer } = await import("@/lib/paystack-transfers.server");
        outcome = await initiateTransfer({
          amountNaira: amount,
          recipientCode,
          reference: `zlx-${wd.reference}`.slice(0, 100),
          reason: `Zealex withdrawal ${wd.reference}`,
        });
      } catch (err) {
        // Transfer never left — return the money.
        await refundWallet(supabaseAdmin, wd.user_id, amount);
        throw err instanceof Error ? err : new Error("Transfer failed");
      }

      if (outcome.status === "failed") {
        await refundWallet(supabaseAdmin, wd.user_id, amount);
        await supabaseAdmin
          .from("withdrawal_requests")
          .update({
            status: "pending",
            stage: "under_review",
            transfer_reference: `zlx-${wd.reference}`.slice(0, 100),
          })
          .eq("id", wd.id);
        throw new Error(outcome.message ?? "The payment provider rejected this transfer");
      }

      // 4) Record the payout on the request; the webhook (or "Check status") finalizes it.
      await supabaseAdmin
        .from("withdrawal_requests")
        .update({
          status: "approved",
          stage: "approved",
          bank_name: destination.bankName,
          account_number: destination.accountNumber,
          account_name: accountName,
          transfer_recipient_code: outcome.recipientCode ?? null,
          transfer_code: outcome.transferCode ?? null,
          transfer_reference: outcome.transferReference ?? null,
        })
        .eq("id", wd.id);

      await supabaseAdmin.from("notifications").insert({
        user_id: wd.user_id,
        title: outcome.status === "success" ? "Withdrawal paid" : "Withdrawal approved",
        body:
          outcome.status === "success"
            ? `${naira} has been sent to ${accountName} (${destination.bankName}).`
            : `${naira} to ${accountName} (${destination.bankName}) is on its way. Ref ${outcome.transferReference ?? wd.reference}.`,
        category: "withdrawal",
      });
      await logAudit("withdrawal.approved", "withdrawal_requests", wd.id, {
        transfer_code: outcome.transferCode ?? null,
        transfer_reference: outcome.transferReference ?? null,
        note: data.note ?? null,
      });
      return { ok: true, duplicate: false, status: "approved", amount, transferSent: true };
    }

    // status === "paid": manual finalization (money sent outside the flow) or
    // confirming an existing transfer.
    if (alreadyHasTransfer) {
      await supabaseAdmin
        .from("withdrawal_requests")
        .update({ status: "paid", stage: "paid" })
        .eq("id", wd.id);
    } else {
      // Manual payout: the wallet was never debited by an approval, so debit it now.
      if (wd.status !== "paid") await debitWallet(supabaseAdmin, wd.user_id, amount);
      if (destination) {
        await supabaseAdmin
          .from("withdrawal_requests")
          .update({
            status: "paid",
            stage: "paid",
            bank_name: wd.bank_name ?? destination.bankName,
            account_number: wd.account_number ?? destination.accountNumber,
            account_name: wd.account_name ?? destination.accountName,
          })
          .eq("id", wd.id);
      } else {
        await supabaseAdmin
          .from("withdrawal_requests")
          .update({ status: "paid", stage: "paid" })
          .eq("id", wd.id);
      }
    }
    await supabaseAdmin.from("notifications").insert({
      user_id: wd.user_id,
      title: "Withdrawal paid",
      body: `${naira} has been marked as paid by the finance team.`,
      category: "withdrawal",
    });
    await logAudit("withdrawal.paid", "withdrawal_requests", wd.id, { note: data.note ?? null });
    return { ok: true, duplicate: false, status: "paid", amount };
  });

/** Re-checks a transfer's live status with Paystack and finalizes the request. */
export const checkWithdrawalTransferServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const roles = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (roles.error) throw new Error("Unable to verify administrator role");
    const isAdmin = (roles.data ?? []).some((row) =>
      ["admin", "super_admin", "finance"].includes(String((row as { role?: string }).role ?? "")),
    );
    if (!isAdmin) throw new Error("Unauthorized: admin privileges required");

    const { supabaseAdmin } = await importClient();
    const { data: wd } = await supabaseAdmin
      .from("withdrawal_requests")
      .select(
        "id, user_id, amount, status, reference, transfer_code, transfer_reference, bank_name, account_name",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!wd) throw new Error("Withdrawal request not found");
    if (!wd.transfer_code && !wd.transfer_reference) {
      throw new Error("No transfer has been sent for this request yet");
    }
    if (wd.status === "paid") {
      return { status: "paid", message: "Already finalized as paid" };
    }

    const { verifyTransfer } = await import("@/lib/paystack-transfers.server");
    const result = await verifyTransfer(wd.transfer_code ?? wd.transfer_reference!);
    const amount = Number(wd.amount);

    if (result.status === "success") {
      await supabaseAdmin
        .from("withdrawal_requests")
        .update({ status: "paid", stage: "paid" })
        .eq("id", wd.id);
      await supabaseAdmin.from("notifications").insert({
        user_id: wd.user_id,
        title: "Withdrawal paid",
        body: `₦${amount.toLocaleString()} has been delivered to ${wd.account_name ?? "your account"}.`,
        category: "withdrawal",
      });
      await logAudit("withdrawal.transfer_confirmed", "withdrawal_requests", wd.id, {
        transfer_code: result.code ?? wd.transfer_code,
      });
      return { status: "paid", message: "Transfer confirmed as paid" };
    }

    if (result.status === "failed") {
      // Money never arrived: refund and send the request back to the queue.
      await refundWallet(supabaseAdmin, wd.user_id, amount);
      await supabaseAdmin
        .from("withdrawal_requests")
        .update({ status: "pending", stage: "under_review", transfer_code: null })
        .eq("id", wd.id);
      await supabaseAdmin.from("notifications").insert({
        user_id: wd.user_id,
        title: "Withdrawal transfer failed",
        body: `The transfer of ₦${amount.toLocaleString()} did not go through. Your wallet has been refunded and the request is back in review.`,
        category: "withdrawal",
      });
      await logAudit("withdrawal.transfer_failed", "withdrawal_requests", wd.id, {
        message: result.message ?? null,
      });
      return { status: "failed", message: result.message ?? "Transfer failed — wallet refunded" };
    }

    return { status: "pending", message: result.message ?? "Transfer is still processing" };
  });

export function useUpdateWithdrawalStatus() {
  const qc = useQueryClient();
  const updateWithdrawalStatus = useServerFn(updateWithdrawalStatusServer);

  return useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string;
      status: "approved" | "rejected" | "paid";
      note?: string;
    }) => {
      const result = await updateWithdrawalStatus({
        data: {
          id,
          status,
          note,
        },
      });
      return result;
    },
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function useUpdateTransactionStatus() {
  const qc = useQueryClient();
  const updateTransactionStatus = useServerFn(updateTransactionStatusServer);
  return useMutation({
    mutationFn: async ({
      id,
      status,
      stage,
      note,
    }: {
      id: string;
      status: "pending" | "processing" | "completed" | "rejected" | "cancelled";
      stage: string;
      note?: string;
    }) => {
      return updateTransactionStatus({ data: { id, status, stage, note } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

const updateTransactionStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["processing", "completed", "rejected", "cancelled"]),
  stage: z.string().min(1).max(40),
  note: z.string().max(400).optional(),
}).superRefine((value, ctx) => {
  if (value.status === "rejected" && !value.note?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "A rejection reason is required" });
  }
});

export const updateTransactionStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => updateTransactionStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error("Unable to verify administrator role");
    if (!(roles ?? []).some((row) => ["ADMIN", "SUPER_ADMIN", "FINANCE"].includes(String(row.role).toUpperCase()))) {
      throw new Error("Unauthorized: admin privileges required");
    }

    const stage = data.status === "completed"
      ? "payout_executed"
      : data.status === "rejected"
        ? "rejected"
        : data.stage;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc("settle_exchange_transaction", {
      _transaction_id: data.id,
      _admin_id: context.userId,
      _target_status: data.status,
      _stage: stage,
      _note: data.note?.trim() ?? null,
    });
    if (error) throw new Error(error.message || "Exchange update failed");
    return result as { ok: boolean; duplicate: boolean; status: string; amount: number };
  });

const adminRateUpdateSchema = z.object({
  kind: z.enum(["crypto", "giftcard"]),
  id: z.string().uuid(),
  buyRate: z.number().finite().nonnegative().max(1_000_000_000_000),
  sellRate: z.number().finite().nonnegative().max(1_000_000_000_000),
});

export const updateAdminRateServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => adminRateUpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error("Unable to verify administrator role");
    if (!(roles ?? []).some((row) => ["ADMIN", "SUPER_ADMIN", "FINANCE"].includes(String(row.role).toUpperCase()))) {
      throw new Error("Unauthorized: admin privileges required");
    }

    const table = data.kind === "crypto" ? "crypto_rates" : "giftcard_rates";
    const { data: updated, error } = await (await import("@/integrations/supabase/client.server")).supabaseAdmin
      .from(table)
      .update({ buy_rate: data.buyRate, sell_rate: data.sellRate } as never)
      .eq("id", data.id)
      .select("id, buy_rate, sell_rate")
      .single();
    if (error) throw new Error(error.message || "Rate update failed");

    await logAudit("rate.admin.update", table, data.id, {
      buy_rate: data.buyRate,
      sell_rate: data.sellRate,
      admin_id: context.userId,
    });
    return updated;
  });

export function useUpdateAdminRate() {
  const qc = useQueryClient();
  const updateRate = useServerFn(updateAdminRateServer);
  return useMutation({
    mutationFn: (data: { kind: "crypto" | "giftcard"; id: string; buyRate: number; sellRate: number }) =>
      updateRate({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rates"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function useSetProfileStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "active" | "suspended" | "banned";
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ account_status: status })
        .eq("id", id);
      if (error) throw error;
      await logAudit("user." + status, "profiles", id, {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useAdjustWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      walletId,
      userId,
      delta,
      reason,
    }: {
      walletId: string;
      userId: string;
      delta: number;
      reason: string;
    }) => {
      const { data: w, error: e1 } = await supabase
        .from("wallets")
        .select("balance")
        .eq("id", walletId)
        .maybeSingle();
      if (e1 || !w) throw e1 ?? new Error("Wallet not found");
      const newBalance = Number(w.balance) + delta;
      if (newBalance < 0) throw new Error("Balance cannot go negative");
      const { error } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("id", walletId);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: userId,
        title: delta >= 0 ? "Wallet credited" : "Wallet debited",
        body: `${delta >= 0 ? "Credit" : "Debit"} of ₦${Math.abs(delta).toLocaleString()} — ${reason}`,
        category: "wallet",
      });
      await logAudit(delta >= 0 ? "wallet.credit" : "wallet.debit", "wallets", walletId, {
        delta,
        reason,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useAdminRoles() {
  return useQuery({
    queryKey: ["admin", "roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      return (data ?? []) as { user_id: string; role: string }[];
    },
  });
}

export function useGrantRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: role as any });
      if (error && !error.message.includes("duplicate")) throw error;
      await logAudit("role.grant", "user_roles", userId, { role });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
}

export function useRevokeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as any);
      if (error) throw error;
      await logAudit("role.revoke", "user_roles", userId, { role });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: ["admin", "audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as {
        id: string;
        admin_id: string;
        action: string;
        entity_type: string | null;
        entity_id: string | null;
        details: Record<string, unknown> | null;
        created_at: string;
      }[];
    },
  });
}
