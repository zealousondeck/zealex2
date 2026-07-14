import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Bitcoin,
  Eye,
  EyeOff,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  useWallet,
  useTransactions,
  useProfile,
  type Transaction,
} from "@/lib/dashboard-data";
import { nairaFormatter } from "@/lib/market-data";
import { StageTracker } from "@/components/dashboard/StageTracker";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: WalletPage,
});

const quickActions = [
  { to: "/dashboard/deposit", label: "Deposit", icon: ArrowDownLeft },
  { to: "/dashboard/withdraw", label: "Withdraw", icon: ArrowUpRight },
  { to: "/dashboard/exchange", label: "Exchange", icon: Bitcoin },
  { to: "/dashboard/exchange", label: "Gift card", icon: Gift },
  { to: "/dashboard/kyc", label: "Verify KYC", icon: ShieldCheck },
  { to: "/dashboard/referrals", label: "Refer & earn", icon: Users },
] as const;

function WalletPage() {
  const [hidden, setHidden] = useState(false);
  const { data: profile } = useProfile();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: transactions, isLoading: txLoading } = useTransactions(6);

  const balance = wallet?.balance ?? 0;
  const firstName = profile?.full_name?.split(" ")[0] ?? "trader";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Welcome back,</p>
        <h1 className="text-2xl font-bold capitalize">{firstName}</h1>
      </div>

      {/* Wallet summary */}
      <div className="overflow-hidden rounded-3xl bg-gradient-ink p-6 text-ink-foreground shadow-card">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-foreground/70">
            Available balance
          </span>
          <button
            onClick={() => setHidden((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"
            aria-label={hidden ? "Show balance" : "Hide balance"}
          >
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          {walletLoading ? (
            <Skeleton className="h-10 w-48 bg-white/10" />
          ) : (
            <span className="text-4xl font-bold tracking-tight">
              {hidden ? "••••••" : nairaFormatter.format(balance)}
            </span>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <Link
            to="/dashboard/exchange"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold py-3 text-sm font-bold text-gold-foreground transition-transform hover:scale-[1.02]"
          >
            <ArrowUpRight className="h-4 w-4" /> Exchange
          </Link>
          <Link
            to="/dashboard/exchange"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-sm font-bold text-ink-foreground transition-colors hover:bg-white/15"
          >
            <ArrowDownLeft className="h-4 w-4" /> Withdraw
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center transition-colors hover:border-gold hover:bg-secondary"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold-soft text-foreground">
                <action.icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold leading-tight">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Recent transactions
          </h2>
          <Link
            to="/dashboard/exchange"
            className="text-sm font-semibold text-gold hover:underline"
          >
            New
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-card">
          {txLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (transactions ?? []).length === 0 ? (
            <EmptyTransactions />
          ) : (
            <ul className="divide-y divide-border">
              {(transactions ?? []).map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyTransactions() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
        <Receipt className="h-6 w-6" />
      </span>
      <div>
        <p className="font-semibold">No transactions yet</p>
        <p className="text-sm text-muted-foreground">
          Your trades will appear here once you make your first exchange.
        </p>
      </div>
      <Link
        to="/dashboard/exchange"
        className="mt-1 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-gold-foreground"
      >
        Start an exchange
      </Link>
    </div>
  );
}

export function TransactionRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.type === "sell" || tx.type === "deposit";
  const Icon = tx.category === "giftcard" ? Gift : Bitcoin;
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold capitalize">
          {tx.type} {tx.asset}
        </p>
        <p className="text-xs text-muted-foreground">
          Ref {tx.reference} ·{" "}
          {new Date(tx.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
      <div className="text-right">
        <p
          className={cn(
            "font-bold",
            isCredit ? "text-success" : "text-foreground",
          )}
        >
          {isCredit ? "+" : "-"}
          {nairaFormatter.format(Number(tx.amount))}
        </p>
        <StatusBadge status={tx.status} />
      </div>
    </li>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-success/10 text-success",
    pending: "bg-gold-soft text-gold-foreground",
    failed: "bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        map[status] ?? "bg-secondary text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}
