import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Users, TrendingUp, Wallet } from "lucide-react";
import { useReferralOverview, useSetReferralEarnings } from "@/lib/admin-referrals";
import { useAppSettings, useUpdateSetting } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nairaFormatter } from "@/lib/market-data";
import { useHasPermission } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/referrals")({
  component: ReferralsAdmin,
});

function ReferralsAdmin() {
  const { allowed } = useHasPermission("manage_referrals");
  const { data: overview, isLoading } = useReferralOverview();
  const { data: settings } = useAppSettings();
  const update = useUpdateSetting();
  const adjust = useSetReferralEarnings();
  const [pct, setPct] = useState<string>("");
  const [adjustments, setAdjustments] = useState<Record<string, { delta: string; reason: string }>>({});

  if (!allowed)
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
        You don't have permission to manage referrals.
      </div>
    );

  const current = Number(settings?.referral_percent ?? 5);
  const value = pct === "" ? String(current) : pct;

  async function savePct() {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) return toast.error("Enter 0–100");
    try {
      await update.mutateAsync({ key: "referral_percent", value: n });
      toast.success("Referral rate updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function submitAdjust(uid: string) {
    const a = adjustments[uid];
    const delta = Number(a?.delta ?? 0);
    if (!delta) return toast.error("Enter amount");
    if (!a?.reason?.trim()) return toast.error("Reason required");
    try {
      await adjust.mutateAsync({ referrerId: uid, delta, reason: a.reason });
      toast.success("Adjusted");
      setAdjustments((s) => ({ ...s, [uid]: { delta: "", reason: "" } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Referral Management</h1>
        <p className="text-sm text-muted-foreground">
          Configure the referral commission and monitor top referrers.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Users} label="Total referrals" value={String(overview?.totalRefs ?? 0)} />
        <Stat icon={Wallet} label="Commission paid" value={nairaFormatter.format(overview?.totalPaid ?? 0)} />
        <Stat icon={TrendingUp} label="Current rate" value={`${current}%`} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="font-display text-lg font-bold">Referral percentage</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Applied to completed transactions of referred users.
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">Percent (%)</Label>
            <Input type="number" min="0" max="100" step="0.5" value={value} onChange={(e) => setPct(e.target.value)} />
          </div>
          <Button variant="gold" className="self-end" onClick={savePct} disabled={update.isPending}>
            Save
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <p className="font-display text-lg font-bold">Top referrers</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Referrals</th>
                <th className="px-4 py-3">Earnings</th>
                <th className="px-4 py-3 text-right">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
              {(overview?.top ?? []).map((r, i) => {
                const a = adjustments[r.user_id] ?? { delta: "", reason: "" };
                return (
                  <tr key={r.user_id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold">#{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{r.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.referral_code ?? "—"}</td>
                    <td className="px-4 py-3">{r.referrals}</td>
                    <td className="px-4 py-3 font-bold">{nairaFormatter.format(r.earnings)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Input
                          type="number"
                          placeholder="±₦"
                          className="h-8 w-24"
                          value={a.delta}
                          onChange={(e) => setAdjustments((s) => ({ ...s, [r.user_id]: { ...a, delta: e.target.value } }))}
                        />
                        <Input
                          placeholder="Reason"
                          className="h-8 w-32"
                          value={a.reason}
                          onChange={(e) => setAdjustments((s) => ({ ...s, [r.user_id]: { ...a, reason: e.target.value } }))}
                        />
                        <Button size="sm" variant="gold" onClick={() => submitAdjust(r.user_id)}>Apply</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && (overview?.top ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No referrals yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold">{value}</p>
    </div>
  );
}
