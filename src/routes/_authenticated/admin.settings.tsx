import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppSettings, useUpdateSetting } from "@/lib/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

const FIELDS: { key: string; label: string; type: "text" | "number" | "email" | "phone" }[] = [
  { key: "exchange_name", label: "Exchange name", type: "text" },
  { key: "support_email", label: "Support email", type: "email" },
  { key: "support_phone", label: "Support phone", type: "phone" },
  { key: "referral_percentage", label: "Referral commission (%)", type: "number" },
  { key: "min_withdrawal", label: "Minimum withdrawal (NGN)", type: "number" },
  { key: "max_withdrawal", label: "Maximum withdrawal (NGN)", type: "number" },
];

function SettingsPage() {
  const { data, isLoading } = useAppSettings();
  const update = useUpdateSetting();
  const [form, setForm] = useState<Record<string, string>>({});
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    if (!data) return;
    const f: Record<string, string> = {};
    for (const field of FIELDS) f[field.key] = String(data[field.key] ?? "");
    setForm(f);
    setMaintenance(Boolean(data.maintenance_mode));
  }, [data]);

  async function save() {
    try {
      for (const field of FIELDS) {
        const raw = form[field.key] ?? "";
        const value = field.type === "number" ? Number(raw) : raw;
        await update.mutateAsync({ key: field.key, value });
      }
      await update.mutateAsync({ key: "maintenance_mode", value: maintenance });
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Global configuration for Zealex Exchange</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    type={f.type === "number" ? "number" : "text"}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-semibold">Maintenance mode</p>
                <p className="text-xs text-muted-foreground">
                  When enabled, users see a maintenance banner across the app.
                </p>
              </div>
              <Switch checked={maintenance} onCheckedChange={setMaintenance} />
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="gold" onClick={save} disabled={update.isPending}>
                Save all changes
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
