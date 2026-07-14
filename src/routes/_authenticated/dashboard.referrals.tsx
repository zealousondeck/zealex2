import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Trophy, Users, Coins } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/dashboard-data";
import { nairaFormatter } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/referrals")({
  component: ReferralsPage,
});

type LeaderRow = {
  referrer_id: string;
  display_name: string;
  referrals_count: number;
  total_earnings: number;
};

type MyRef = {
  id: string;
  referred_user_id: string;
  earnings: number;
  status: string;
  created_at: string;
};

function ReferralsPage() {
  const { data: profile } = useProfile();

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["referral-leaderboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("referral_leaderboard")
        .select("*")
        .limit(20);
      return (data ?? []) as LeaderRow[];
    },
  });

  const { data: myReferrals = [] } = useQuery({
    queryKey: ["my-referrals"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [] as MyRef[];
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", uid)
        .order("created_at", { ascending: false });
      return (data ?? []) as MyRef[];
    },
  });

  const myRank = profile
    ? leaderboard.findIndex((r) => r.referrer_id === profile.id) + 1
    : 0;
  const myEarnings = myReferrals.reduce((s, r) => s + Number(r.earnings), 0);
  const code = profile?.referral_code ?? "—";
  const link = typeof window !== "undefined" ? `${window.location.origin}/auth?ref=${code}` : "";

  function copy() {
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referrals</h1>
        <p className="text-sm text-muted-foreground">Earn when your friends trade.</p>
      </div>

      <div className="rounded-3xl bg-gradient-ink p-6 text-ink-foreground shadow-card">
        <p className="text-sm font-medium text-ink-foreground/70">Your referral code</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-3xl font-bold tracking-widest">{code}</span>
          <button onClick={copy} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold">
            <Copy className="mr-1 inline h-3 w-3" /> Copy link
          </button>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat icon={Trophy} label="Rank" value={myRank > 0 ? `#${myRank}` : "—"} />
          <Stat icon={Users} label="Referred" value={String(myReferrals.length)} />
          <Stat icon={Coins} label="Earnings" value={nairaFormatter.format(myEarnings)} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Leaderboard
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {leaderboard.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Be the first to invite a friend!
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {leaderboard.map((row, i) => {
                const isMe = profile?.id === row.referrer_id;
                return (
                  <li
                    key={row.referrer_id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      isMe && "bg-gold-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-full text-sm font-bold",
                        i === 0
                          ? "bg-gold text-gold-foreground"
                          : i < 3
                            ? "bg-secondary text-foreground"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {row.display_name} {isMe && <span className="text-gold">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.referrals_count} referred
                      </p>
                    </div>
                    <span className="font-bold text-gold">
                      {nairaFormatter.format(Number(row.total_earnings))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Your referred users
        </h2>
        <div className="rounded-2xl border border-border bg-card">
          {myReferrals.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No referrals yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {myReferrals.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold">
                      User {r.referred_user_id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="font-bold text-gold">
                    {nairaFormatter.format(Number(r.earnings))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <Icon className="mb-1 h-4 w-4 text-gold" />
      <p className="text-[10px] uppercase tracking-wide text-ink-foreground/60">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
