import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
      const patch: Record<string, unknown> = { status, stage };
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

export function useUpdateWithdrawalStatus() {
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
      status: "approved" | "rejected" | "paid" | "pending";
      stage: string;
      note?: string;
      userId: string;
      amount: number;
    }) => {
      const patch: Record<string, unknown> = { status, stage };
      if (note) patch.note = note;
      const { error } = await supabase.from("withdrawal_requests").update(patch).eq("id", id);
      if (error) throw error;

      if (status === "rejected") {
        // Refund wallet
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
          status === "paid"
            ? "Withdrawal paid"
            : status === "approved"
              ? "Withdrawal approved"
              : status === "rejected"
                ? "Withdrawal rejected"
                : "Withdrawal updated",
        body: `Your withdrawal of ₦${amount.toLocaleString()} was ${status}.${note ? " Note: " + note : ""}`,
        category: "withdrawal",
      });
      await logAudit("withdrawal." + status, "withdrawal_requests", id, { amount, note });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useUpdateTransactionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      stage,
      userId,
      amount,
      note,
    }: {
      id: string;
      status: "completed" | "rejected" | "pending";
      stage: string;
      userId: string;
      amount: number;
      note?: string;
    }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ status, stage })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: userId,
        title: `Trade ${status}`,
        body: `Trade of ₦${amount.toLocaleString()} was ${status}.${note ? " " + note : ""}`,
        category: "trade",
      });
      await logAudit("transaction." + status, "transactions", id, { amount, note });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useSetProfileStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "suspended" | "banned" }) => {
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
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
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
