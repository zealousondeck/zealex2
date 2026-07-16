import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { useAdminWallets, useAdjustWallet } from "@/lib/admin-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { nairaFormatter } from "@/lib/market-data";

export const Route = createFileRoute("/_authenticated/admin/wallets")({
  component: WalletsPage,
});

type Row = {
  id: string;
  user_id: string;
  currency: string;
  balance: number;
  updated_at: string;
  profile?: { full_name: string | null; email: string | null };
};

function WalletsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAdminWallets(search);
  const [active, setActive] = useState<Row | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Wallets</h1>
          <p className="text-sm text-muted-foreground">
            Total tracked: {(data ?? []).length} wallets
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user" className="pl-9" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Last change</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {(data ?? []).map((w) => (
                <tr key={w.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{w.profile?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{w.profile?.email ?? w.user_id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{w.currency}</td>
                  <td className="px-4 py-3 font-bold">{nairaFormatter.format(Number(w.balance))}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(w.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setActive(w)}>
                      Adjust
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && (data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No wallets.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {active && <AdjustDialog wallet={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function AdjustDialog({ wallet, onClose }: { wallet: Row; onClose: () => void }) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const mut = useAdjustWallet();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Enter a positive amount");
    if (!reason.trim()) return toast.error("Reason is required");
    try {
      await mut.mutateAsync({
        walletId: wallet.id,
        userId: wallet.user_id,
        delta: direction === "credit" ? n : -n,
        reason: reason.trim(),
      });
      toast.success(`Wallet ${direction}ed`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border p-4">
          <h3 className="font-bold">Adjust wallet</h3>
          <p className="text-xs text-muted-foreground">
            {wallet.profile?.full_name ?? wallet.user_id.slice(0, 8)} · Current balance{" "}
            <b>{nairaFormatter.format(Number(wallet.balance))}</b>
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex gap-1 rounded-xl border border-border p-1">
            {(["credit", "debit"] as const).map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDirection(d)}
                className={
                  "flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold capitalize " +
                  (direction === d ? "bg-gold text-gold-foreground" : "text-muted-foreground")
                }
              >
                {d}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="amt">Amount (NGN)</Label>
            <Input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rn">Reason</Label>
            <Input id="rn" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" disabled={mut.isPending}>
            Confirm
          </Button>
        </div>
      </form>
    </div>
  );
}
