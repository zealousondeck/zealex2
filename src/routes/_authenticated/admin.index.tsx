import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  Activity,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Gift,
  CheckCircle2,
  Banknote,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useAdminStats, useDailyTxSeries, useAdminUsers, useAdminDeposits } from "@/lib/admin-data";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nairaFormatter } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "gold" | "success" | "warn" | "danger";
}) {
  const toneClass = {
    default: "bg-secondary text-foreground",
    gold: "bg-gold-soft text-foreground",
    success: "bg-success/10 text-success",
    warn: "bg-gold-soft text-foreground",
    danger: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <span className={cn("grid h-8 w-8 place-items-center rounded-xl", toneClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function useRecentTx() {
  return useQuery({
    queryKey: ["admin", "recent-tx"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });
}

function useRecentSignups() {
  return useQuery({
    queryKey: ["admin", "recent-signups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });
}

function AdminOverview() {
  const { data: stats, isLoading } = useAdminStats();
  const { data: series } = useDailyTxSeries();
  const { data: recentTx } = useRecentTx();
  const { data: recentSignups } = useRecentSignups();
  const { data: pendingDeposits } = useAdminDeposits("pending");

  const pieData = [
    { name: "Crypto", value: stats?.cryptoVolume ?? 0, color: "hsl(45 90% 55%)" },
    { name: "Gift Cards", value: stats?.giftVolume ?? 0, color: "hsl(15 80% 60%)" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Realtime snapshot of Zealex Exchange · updates every 30 seconds
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total Users" value={isLoading ? "…" : stats!.totalUsers} icon={Users} tone="gold" />
        <StatCard label="Active Users" value={isLoading ? "…" : stats!.activeUsers} icon={Activity} tone="success" />
        <StatCard label="Pending KYC" value={isLoading ? "…" : stats!.pendingKyc} icon={ShieldCheck} tone="warn" hint={`${stats?.approvedKyc ?? 0} approved`} />
        <StatCard label="Pending Deposits" value={isLoading ? "…" : stats!.pendingDeposits} icon={ArrowDownLeft} tone="warn" />
        <StatCard label="Pending Withdrawals" value={isLoading ? "…" : stats!.pendingWithdrawals} icon={ArrowUpRight} tone="warn" />
        <StatCard label="Pending Crypto" value={isLoading ? "…" : stats!.pendingCrypto} icon={Coins} tone="default" />
        <StatCard label="Pending Gift Cards" value={isLoading ? "…" : stats!.pendingGift} icon={Gift} tone="default" />
        <StatCard label="Completed Trades" value={isLoading ? "…" : stats!.completedTx} icon={CheckCircle2} tone="success" />
        <StatCard label="Total Volume" value={isLoading ? "…" : nairaFormatter.format(stats!.totalVolume)} icon={TrendingUp} tone="gold" />
        <StatCard label="Est. Revenue" value={isLoading ? "…" : nairaFormatter.format(stats!.totalRevenue)} icon={Banknote} tone="success" hint="2% spread assumption" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Daily Volume (14 days)</h2>
              <p className="text-xs text-muted-foreground">Sum of transactions per day</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={series ?? []}>
                <defs>
                  <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(45 90% 55%)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="hsl(45 90% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={50} />
                <Tooltip formatter={(v) => nairaFormatter.format(Number(v))} />
                <Area type="monotone" dataKey="volume" stroke="hsl(45 90% 55%)" strokeWidth={2} fill="url(#vg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-bold">Crypto vs Gift Cards</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={45} outerRadius={80} paddingAngle={4}>
                  {pieData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => nairaFormatter.format(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="mb-3 font-bold">Transaction Count (14 days)</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={series ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={30} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(45 85% 45%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Recent Signups</h2>
            <Link to="/admin/users" className="text-xs font-semibold text-gold hover:underline">
              View all
            </Link>
          </div>
          <ul className="space-y-3">
            {(recentSignups ?? []).map((s: any) => (
              <li key={s.id} className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gold-soft font-bold uppercase">
                  {(s.full_name || s.email || "?").charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.full_name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
            {(recentSignups ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No signups yet.</p>
            )}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Recent Transactions</h2>
            <Link to="/admin/transactions" className="text-xs font-semibold text-gold hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {(recentTx ?? []).map((t: any) => (
              <li key={t.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-semibold">
                    {t.asset} · <span className="uppercase text-muted-foreground">{t.type}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.reference} · {new Date(t.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{nairaFormatter.format(Number(t.amount))}</p>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">{t.status}</p>
                </div>
              </li>
            ))}
            {(recentTx ?? []).length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No transactions yet.</p>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Pending Deposits</h2>
            <Link to="/admin/deposits" className="text-xs font-semibold text-gold hover:underline">
              Review
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {(pendingDeposits ?? []).slice(0, 6).map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-semibold">{d.reference}</p>
                  <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
                </div>
                <p className="text-sm font-bold">{nairaFormatter.format(Number(d.amount))}</p>
              </li>
            ))}
            {(pendingDeposits ?? []).length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No pending deposits.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
