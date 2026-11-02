import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useAppSettings, useUpdateSetting } from "@/lib/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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

type Fact = { id: string; label: string; body: string; active: boolean };

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `fact_${Math.random().toString(36).slice(2, 8)}`;

function SettingsPage() {
  const { data, isLoading } = useAppSettings();
  const update = useUpdateSetting();
  const [form, setForm] = useState<Record<string, string>>({});
  const [maintenance, setMaintenance] = useState(false);
  const [facts, setFacts] = useState<Fact[]>([]);

  useEffect(() => {
    if (!data) return;
    const f: Record<string, string> = {};
    for (const field of FIELDS) f[field.key] = String(data[field.key] ?? "");
    setForm(f);
    setMaintenance(Boolean(data.maintenance_mode));
    const raw = data.assistant_facts;
    if (Array.isArray(raw)) {
      setFacts(
        raw
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
          .map((item) => ({
            id: String(item.id ?? ""),
            label: String(item.label ?? ""),
            body: String(item.body ?? ""),
            active: item.active !== false,
          })),
      );
    }
  }, [data]);

  async function save() {
    try {
      const cleaned: Fact[] = [];
      const seen = new Set<string>();
      for (const fact of facts) {
        if (!fact.label.trim() && !fact.body.trim()) continue;
        if (!fact.label.trim() || !fact.body.trim()) {
          throw new Error(`Fact "${fact.label || fact.id}" needs both a label and text`);
        }
        const id = fact.id.trim() || slugify(fact.label);
        if (seen.has(id)) throw new Error(`Duplicate fact key: ${id}`);
        seen.add(id);
        cleaned.push({ id, label: fact.label.trim(), body: fact.body.trim(), active: fact.active });
      }
      for (const field of FIELDS) {
        const raw = form[field.key] ?? "";
        const value = field.type === "number" ? Number(raw) : raw;
        await update.mutateAsync({ key: field.key, value });
      }
      await update.mutateAsync({ key: "maintenance_mode", value: maintenance });
      await update.mutateAsync({ key: "assistant_facts", value: cleaned });
      setFacts(cleaned);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  function patchFact(index: number, patch: Partial<Fact>) {
    setFacts((list) => list.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addFact() {
    setFacts((list) => [
      ...list,
      { id: "", label: "", body: "", active: true },
    ]);
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
          </>
        )}
      </div>

      {/* Zealex Assistant confirmed facts */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Zealex Assistant facts</h2>
            <p className="text-sm text-muted-foreground">
              Confirmed facts the assistant may quote. Deactivated facts are hidden from answers.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addFact}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add fact
          </Button>
        </div>

        {!isLoading && facts.length === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No facts yet — add one so the assistant answers from confirmed details instead of the
            fallback.
          </p>
        )}

        <div className="mt-4 space-y-3">
          {facts.map((fact, index) => (
            <div
              key={`${fact.id}-${index}`}
              className={
                fact.active
                  ? "space-y-3 rounded-xl border border-border bg-background p-4"
                  : "space-y-3 rounded-xl border border-border bg-secondary/40 p-4 opacity-70"
              }
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-40 flex-1 space-y-1.5">
                  <Label htmlFor={`fact-label-${index}`}>Label</Label>
                  <Input
                    id={`fact-label-${index}`}
                    value={fact.label}
                    maxLength={60}
                    placeholder="e.g. Payout timing"
                    onChange={(e) => patchFact(index, { label: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-4 pb-1.5">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`fact-active-${index}`}
                      checked={fact.active}
                      onCheckedChange={(checked) => patchFact(index, { active: checked })}
                    />
                    <Label htmlFor={`fact-active-${index}`} className="text-xs">
                      {fact.active ? "Active" : "Deactivated"}
                    </Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${fact.label || "fact"}`}
                    onClick={() => setFacts((list) => list.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`fact-body-${index}`}>Confirmed text</Label>
                <Textarea
                  id={`fact-body-${index}`}
                  rows={2}
                  maxLength={600}
                  value={fact.body}
                  placeholder="Exactly what the assistant may tell users"
                  onChange={(e) => patchFact(index, { body: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="gold" onClick={save} disabled={update.isPending}>
          Save all changes
        </Button>
      </div>
    </div>
  );
}
