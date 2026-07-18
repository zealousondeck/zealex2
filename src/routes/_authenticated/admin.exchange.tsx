import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useAdminTransactions, useUpdateTransactionStatus, type AdminTx } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { nairaFormatter } from "@/lib/market-data";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useHasPermission } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/exchange")({
  component: () => <TradeConsole category="crypto" title="Crypto Exchange Orders" />,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-gold-soft text-foreground",
  processing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  completed: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_FILTERS = ["pending", "processing", "completed", "rejected", "cancelled", "all"] as const;


export function TradeConsole({ category, title }: { category: "crypto" | "giftcard"; title: string }) {
  const { allowed } = useHasPermission("manage_transactions");
  const [status, setStatus] = useState("pending");
  const { data, isLoading } = useAdminTransactions({ status, category });
  const mut = useUpdateTransactionStatus();
  const [selected, setSelected] = useState<AdminTx | null>(null);
  const [notes, setNotes] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
        You don't have permission to review orders.
      </div>
    );
  }

  async function openTx(t: AdminTx) {
    setSelected(t);
    setNotes((t as any).reviewer_notes ?? "");
    setProofUrl(null);
    const proof = (t as any).proof_path as string | undefined;
    if (proof) {
      const { data: s } = await supabase.storage.from("kyc-documents").createSignedUrl(proof, 300);
      setProofUrl(s?.signedUrl ?? null);
    }
  }

  async function decide(s: "processing" | "completed" | "rejected" | "cancelled") {
    if (!selected) return;
    if ((s === "rejected" || s === "cancelled") && !notes.trim())
      return toast.error("Reviewer note required");
    const stage =
      s === "completed" ? "paid" : s === "processing" ? "under_review" : s === "cancelled" ? "cancelled" : "under_review";
    try {
      await mut.mutateAsync({
        id: selected.id,
        status: s,
        stage,
        userId: selected.user_id,
        amount: Number(selected.amount),
        note: notes,
      });
      // persist reviewer note & reviewer_at
      await supabase
        .from("transactions")
        .update({ reviewer_notes: notes, reviewed_at: new Date().toISOString() } as any)
        .eq("id", selected.id);
      toast.success(`Marked ${s}`);
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }


  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">Review, approve or reject with notes.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold uppercase",
                status === s ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Asset · Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
              {(data ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 font-mono text-xs">{t.reference}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.user_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3"><p className="font-semibold">{t.asset}</p><p className="text-xs uppercase text-muted-foreground">{t.type}</p></td>
                  <td className="px-4 py-3 font-bold">{nairaFormatter.format(Number(t.amount))}</td>
                  <td className="px-4 py-3 text-xs">{t.quantity ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", STATUS_TONE[t.status] ?? "bg-secondary")}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => openTx(t)}>Open</Button>
                  </td>
                </tr>
              ))}
              {!isLoading && (data ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No orders.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order {selected?.reference}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <Field label="Asset" value={selected.asset} />
                <Field label="Type" value={`${selected.type} · ${selected.category}`} />
                <Field label="Amount" value={nairaFormatter.format(Number(selected.amount))} />
                <Field label="Quantity" value={String(selected.quantity ?? "—")} />
                <Field label="User" value={selected.user_id} />
                <Field label="Stage" value={selected.stage} />
              </div>

              <div>
                <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Proof</p>
                {proofUrl ? (
                  <a href={proofUrl} target="_blank" rel="noreferrer" className="block">
                    <img src={proofUrl} alt="proof" className="max-h-64 w-full rounded-xl border border-border object-contain" />
                  </a>
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    No proof uploaded by user.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Reviewer notes</p>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Note visible in audit log; required for rejection." />
              </div>

              {(selected.status === "pending" || selected.status === "processing") && (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => decide("cancelled")}>Cancel</Button>
                  <Button variant="outline" onClick={() => decide("rejected")}>Reject</Button>
                  {selected.status === "pending" && (
                    <Button variant="secondary" onClick={() => decide("processing")}>Mark processing</Button>
                  )}
                  <Button variant="gold" onClick={() => decide("completed")}>Approve & Complete</Button>
                </div>

              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-all font-semibold">{value}</p>
    </div>
  );
}
