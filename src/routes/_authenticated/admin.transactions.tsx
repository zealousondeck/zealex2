import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { useAdminTransactions, useUpdateTransactionStatus, type AdminTx } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { nairaFormatter } from "@/lib/market-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/transactions")({
  component: TxPage,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-gold-soft text-foreground",
  completed: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-secondary text-muted-foreground",
};

function toCsv(rows: AdminTx[]) {
  const header = ["reference", "type", "category", "asset", "amount", "quantity", "status", "stage", "created_at"];
  const body = rows.map((r) =>
    [r.reference, r.type, r.category, r.asset, r.amount, r.quantity ?? "", r.status, r.stage, r.created_at]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

function TxPage() {
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const { data, isLoading } = useAdminTransactions({ status, category });
  const mut = useUpdateTransactionStatus();

  function exportCsv() {
    const csv = toCsv(data ?? []);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zealex-transactions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function decide(t: AdminTx, s: "completed" | "rejected") {
    try {
      await mut.mutateAsync({
        id: t.id,
        status: s,
        stage: s === "completed" ? "paid" : "under_review",
        userId: t.user_id,
        amount: Number(t.amount),
      });
      toast.success(`Marked ${s}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">Unified crypto & gift card trade log</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="crypto">Crypto</SelectItem>
              <SelectItem value="giftcard">Gift Card</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Type · Asset</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {(data ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 font-mono text-xs">{t.reference}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.user_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{t.asset}</p>
                    <p className="text-xs uppercase text-muted-foreground">
                      {t.type} · {t.category}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-bold">{nairaFormatter.format(Number(t.amount))}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        STATUS_TONE[t.status] ?? "bg-secondary",
                      )}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.status === "pending" ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => decide(t, "rejected")}>
                          Reject
                        </Button>
                        <Button size="sm" variant="gold" onClick={() => decide(t, "completed")}>
                          Complete
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && (data ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No transactions match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
