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
import { useWallet, useTransactions, useProfile, type Transaction } from "@/lib/dashboard-data";
import { nairaFormatter } from "@/lib/market-data";
import { StageTracker } from "@/components/dashboard/StageTracker";
import { ReceiptActions } from "@/components/dashboard/ReceiptActions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: WalletPage,
});

const quickActions = [
  { to: "/dashboard/crypto", label: "Sell Crypto", icon: Bitcoin },
  { to: "/dashboard/exchange", label: "Sell Gift Card", icon: Gift },
  { to: "/dashboard/withdraw", label: "Withdraw", icon: ArrowUpRight },
  { to: "/dashboard/deposit", label: "Deposit", icon: ArrowDownLeft },
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
    <div className="space-y-8 sm:space-y-10">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Welcome back,</p>
        <h1 className="mt-1 text-2xl font-bold capitalize sm:text-3xl">{firstName}</h1>
      </div>

      {/* Wallet summary */}
      <div className="overflow-hidden rounded-2xl bg-gradient-ink p-6 text-ink-foreground shadow-card sm:p-8">
        <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-foreground/75">Available balance</span>
          <button
            onClick={() => setHidden((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"
            aria-label={hidden ? "Show balance" : "Hide balance"}
          >
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-3 flex min-h-12 items-baseline gap-2">
          {walletLoading ? (
            <Skeleton className="h-10 w-48 bg-white/10" />
          ) : (
            <span className="text-3xl font-bold tracking-normal sm:text-4xl">
              {hidden ? "••••••" : nairaFormatter.format(balance)}
            </span>
          )}
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link
            to="/dashboard/exchange"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-3 py-3 text-sm font-bold text-gold-foreground shadow-gold transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            <Bitcoin className="h-4 w-4" /> Sell Crypto
          </Link>
          <Link
            to="/dashboard/exchange"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ink-foreground/20 bg-ink-foreground/10 px-3 py-3 text-sm font-bold text-ink-foreground transition-colors hover:bg-ink-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Gift className="h-4 w-4" /> Sell Gift Card
          </Link>
          <Link
            to="/dashboard/withdraw"
            className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ink-foreground/20 bg-ink-foreground/10 px-3 py-3 text-sm font-bold text-ink-foreground transition-colors hover:bg-ink-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-1"
          >
            <ArrowUpRight className="h-4 w-4" /> Withdraw
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-normal text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className={cn(
                "flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-4 text-center shadow-soft transition-all hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                quickActions.indexOf(action) < 3 && "min-h-32 border-gold/30 bg-card sm:min-h-36",
                quickActions.indexOf(action) >= 3 && "min-h-24 bg-secondary/45 shadow-none",
              )}
            >
              <span className={cn(
                "grid h-11 w-11 place-items-center rounded-xl text-foreground",
                quickActions.indexOf(action) < 3 ? "bg-gold-soft" : "bg-secondary",
              )}>
                <action.icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold leading-tight">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-normal text-muted-foreground">
            Recent transactions
          </h2>
          <Link
            to="/dashboard/exchange"
            className="text-sm font-semibold text-gold hover:underline"
          >
            New
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
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
    <li className="space-y-3 px-4 py-3.5">
      <div className="flex items-center gap-3">
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
          <p className={cn("font-bold", isCredit ? "text-success" : "text-foreground")}>
            {isCredit ? "+" : "-"}
            {nairaFormatter.format(Number(tx.amount))}
          </p>
          <StatusBadge status={tx.status} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <StageTracker stage={tx.stage ?? "submitted"} compact />
        </div>
        <ReceiptActions
          size="xs"
          receipt={{
            title: `${tx.type} ${tx.asset} receipt`,
            reference: tx.reference,
            status: tx.status,
            stage: tx.stage,
            createdAt: tx.created_at,
            rows: [
              { label: "Type", value: `${tx.type} · ${tx.category}` },
              { label: "Asset", value: tx.asset },
              { label: "Amount", value: nairaFormatter.format(Number(tx.amount)) },
              ...(tx.quantity != null ? [{ label: "Quantity", value: String(tx.quantity) }] : []),
            ],
          }}
        />
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
