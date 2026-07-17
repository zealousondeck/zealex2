import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./audit";

export type TopReferrer = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  referral_code: string | null;
  referrals: number;
  earnings: number;
};

export function useReferralOverview() {
  return useQuery({
    queryKey: ["admin", "referrals"],
    queryFn: async () => {
      const { data: refs, error } = await supabase
        .from("referrals")
        .select("referrer_id, earnings, status");
      if (error) throw error;
      const buckets = new Map<string, { count: number; earnings: number }>();
      for (const r of (refs ?? []) as any[]) {
        const b = buckets.get(r.referrer_id) ?? { count: 0, earnings: 0 };
        b.count += 1;
        b.earnings += Number(r.earnings || 0);
        buckets.set(r.referrer_id, b);
      }
      const ids = Array.from(buckets.keys());
      let profiles: any[] = [];
      if (ids.length) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email, referral_code")
          .in("id", ids);
        profiles = data ?? [];
      }
      const pmap = new Map(profiles.map((p) => [p.id, p]));
      const top: TopReferrer[] = ids
        .map((id) => {
          const b = buckets.get(id)!;
          const p = pmap.get(id) ?? {};
          return {
            user_id: id,
            full_name: p.full_name ?? null,
            email: p.email ?? null,
            referral_code: p.referral_code ?? null,
            referrals: b.count,
            earnings: b.earnings,
          };
        })
        .sort((a, b) => b.earnings - a.earnings || b.referrals - a.referrals);

      const totalRefs = (refs ?? []).length;
      const totalPaid = top.reduce((s, r) => s + r.earnings, 0);
      return { top, totalRefs, totalPaid };
    },
  });
}

export function useSetReferralEarnings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ referrerId, delta, reason }: { referrerId: string; delta: number; reason: string }) => {
      // Update the aggregate simply by inserting an adjustment row via updating an existing referral row's earnings
      // Simpler: update the sum on the most recent referral row for that referrer
      const { data: latest } = await supabase
        .from("referrals")
        .select("id, earnings")
        .eq("referrer_id", referrerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latest) throw new Error("Referrer has no referrals yet");
      const next = Number(latest.earnings || 0) + delta;
      if (next < 0) throw new Error("Earnings cannot go negative");
      const { error } = await supabase
        .from("referrals")
        .update({ earnings: next })
        .eq("id", latest.id);
      if (error) throw error;
      await logAudit("referral.adjust", "referrals", latest.id, { delta, reason });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "referrals"] }),
  });
}
