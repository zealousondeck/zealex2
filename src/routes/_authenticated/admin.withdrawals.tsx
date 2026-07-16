import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAdminWithdrawals, useUpdateWithdrawalStatus, type AdminWithdrawal } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { nairaFormatter } from "@/lib/market-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  component: WithdrawalsPage,
});

const TABS = ["pending", "approved", "paid", "rejected", "all"] as const;
const TONE: Record<string, string> = {
  pending: "bg-gold-soft text-foreground",
  approved: "bg-primary/10 text-foreground",
  paid: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

function WithdrawalsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const { data, isLoading } = useAdminWithdrawals(tab);
  const [active, setActive] = useState<AdminWithdrawal | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Withdrawals</h1>
        <p className="text-sm text-muted-foreground">Process user withdrawal requests</p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 font-semibold capitalize transition-colors",
              t === tab ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:bg-secondary",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {(data ?? []).map((d) => (
                <tr key={d.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 font-mono text-xs">{d.reference}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{d.user_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 font-bold">{nairaFormatter.format(Number(d.amount))}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", TONE[d.status] ?? "bg-secondary")}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setActive(d)}>
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && (data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nothing to show.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {active && <WithdrawDialog withdrawal={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function WithdrawDialog({ withdrawal, onClose }: { withdrawal: AdminWithdrawal; onClose: () => void }) {
  const [note, setNote] = useState(withdrawal.note ?? "");
  const mut = useUpdateWithdrawalStatus();

  async function decide(status: "approved" | "rejected" | "paid") {
    if (status === "rejected" && !note.trim()) {
      toast.error("Add a reason for rejection");
      return;
    }
    try {
      await mut.mutateAsync({
        id: withdrawal.id,
        status,
        stage: status === "paid" ? "paid" : status === "approved" ? "approved" : "under_review",
        note: note.trim() || undefined,
        userId: withdrawal.user_id,
        amount: Number(withdrawal.amount),
      });
      toast.success(`Withdrawal ${status}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h3 className="font-bold">Withdrawal · {withdrawal.reference}</h3>
            <p className="text-xs text-muted-foreground">
              {new Date(withdrawal.created_at).toLocaleString()} ·{" "}
              <span className="uppercase">{withdrawal.status}</span>
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="space-y-3 p-5 text-sm">
          <p>
            <span className="text-muted-foreground">Amount:</span>{" "}
            <b>{nairaFormatter.format(Number(withdrawal.amount))}</b>
          </p>
          <p>
            <span className="text-muted-foreground">User:</span> {withdrawal.user_id}
          </p>
          {withdrawal.note && (
            <p>
              <span className="text-muted-foreground">User note:</span> {withdrawal.note}
            </p>
          )}
        </div>
        <div className="space-y-3 border-t border-border p-5">
          <Label htmlFor="rn">Reviewer note / reference</Label>
          <Textarea id="rn" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => decide("rejected")} disabled={mut.isPending}>
              Reject & refund
            </Button>
            <Button variant="outline" onClick={() => decide("approved")} disabled={mut.isPending}>
              Approve
            </Button>
            <Button variant="gold" onClick={() => decide("paid")} disabled={mut.isPending}>
              Mark paid
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
