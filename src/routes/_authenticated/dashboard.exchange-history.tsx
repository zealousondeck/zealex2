import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { nairaFormatter } from "@/lib/market-data";
import { StageTracker } from "@/components/dashboard/StageTracker";
import { StatusBadge } from "./dashboard.deposit";

export const Route = createFileRoute("/_authenticated/dashboard/exchange-history")({
  component: ExchangeHistoryPage,
});

type TradeRow = {
  id: string;
  type: string;
  category: string;
  asset: string | null;
  amount: number;
  quantity: number | null;
  status: string;
  stage: string | null;
  created_at: string;
};

function ExchangeHistoryPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["transactions", "exchange-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .in("category", ["crypto", "giftcard"])
        .order("created_at", { ascending: false });
      return (data ?? []) as TradeRow[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-soft text-foreground">
          <History className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Exchange history</h1>
          <p className="text-sm text-muted-foreground">
            All your crypto and gift card orders in one place.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading your orders…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No exchange orders yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">
                    {r.asset ?? "—"} · {nairaFormatter.format(Number(r.amount))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.category === "giftcard" ? "Gift card" : "Crypto"} · {r.type} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <StageTracker stage={r.stage ?? "submitted"} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
