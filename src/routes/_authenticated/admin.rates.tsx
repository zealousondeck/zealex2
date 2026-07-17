import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  useCryptoRates,
  useGiftcardRates,
  useUpsertCryptoRate,
  useUpsertGiftcardRate,
  useToggleRate,
  useDeleteRate,
  type CryptoRate,
  type GiftcardRate,
} from "@/lib/rates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHasPermission } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/rates")({
  component: RatesPage,
});

function RatesPage() {
  const { allowed } = useHasPermission("manage_rates");
  if (!allowed) return <NoAccess />;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Rate Management</h1>
        <p className="text-sm text-muted-foreground">
          Live rates shown to users. Updates take effect immediately.
        </p>
      </div>
      <Tabs defaultValue="crypto">
        <TabsList>
          <TabsTrigger value="crypto">Crypto</TabsTrigger>
          <TabsTrigger value="giftcard">Gift Cards</TabsTrigger>
        </TabsList>
        <TabsContent value="crypto" className="mt-4">
          <CryptoRatesTable />
        </TabsContent>
        <TabsContent value="giftcard" className="mt-4">
          <GiftcardRatesTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
      You don't have permission to access this section.
    </div>
  );
}

function CryptoRatesTable() {
  const { data, isLoading } = useCryptoRates();
  const upsert = useUpsertCryptoRate();
  const toggle = useToggleRate("crypto");
  const del = useDeleteRate("crypto");
  const [draft, setDraft] = useState<Partial<CryptoRate>>({});

  async function saveNew() {
    if (!draft.symbol || !draft.name) return toast.error("Symbol & name required");
    try {
      await upsert.mutateAsync({
        symbol: draft.symbol.toUpperCase(),
        name: draft.name,
        network: draft.network ?? "",
        buy_rate: Number(draft.buy_rate ?? 0),
        sell_rate: Number(draft.sell_rate ?? 0),
        change_24h: Number(draft.change_24h ?? 0),
        is_active: true,
      });
      setDraft({});
      toast.success("Rate added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Add new</p>
        <div className="grid gap-2 md:grid-cols-6">
          <Input placeholder="Symbol" value={draft.symbol ?? ""} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} />
          <Input placeholder="Name" value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input placeholder="Network" value={draft.network ?? ""} onChange={(e) => setDraft({ ...draft, network: e.target.value })} />
          <Input type="number" placeholder="Buy ₦" value={draft.buy_rate ?? ""} onChange={(e) => setDraft({ ...draft, buy_rate: Number(e.target.value) })} />
          <Input type="number" placeholder="Sell ₦" value={draft.sell_rate ?? ""} onChange={(e) => setDraft({ ...draft, sell_rate: Number(e.target.value) })} />
          <Button variant="gold" onClick={saveNew} disabled={upsert.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Symbol</th>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Network</th>
                <th className="px-3 py-3">Buy ₦</th>
                <th className="px-3 py-3">Sell ₦</th>
                <th className="px-3 py-3">Δ 24h</th>
                <th className="px-3 py-3">Active</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {(data ?? []).map((r) => (
                <CryptoRow key={r.id} row={r} onSave={(patch) => upsert.mutateAsync({ ...r, ...patch })} onToggle={(v) => toggle.mutate({ id: r.id, is_active: v })} onDelete={() => del.mutate(r.id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CryptoRow({
  row,
  onSave,
  onToggle,
  onDelete,
}: {
  row: CryptoRate;
  onSave: (patch: Partial<CryptoRate>) => Promise<unknown>;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const [buy, setBuy] = useState(row.buy_rate);
  const [sell, setSell] = useState(row.sell_rate);
  const [chg, setChg] = useState(row.change_24h);
  const dirty = buy !== row.buy_rate || sell !== row.sell_rate || chg !== row.change_24h;
  return (
    <tr className="hover:bg-secondary/30">
      <td className="px-3 py-2 font-bold">{row.symbol}</td>
      <td className="px-3 py-2">{row.name}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{row.network}</td>
      <td className="px-3 py-2"><Input type="number" className="h-8 w-28" value={buy} onChange={(e) => setBuy(Number(e.target.value))} /></td>
      <td className="px-3 py-2"><Input type="number" className="h-8 w-28" value={sell} onChange={(e) => setSell(Number(e.target.value))} /></td>
      <td className="px-3 py-2"><Input type="number" step="0.01" className="h-8 w-20" value={chg} onChange={(e) => setChg(Number(e.target.value))} /></td>
      <td className="px-3 py-2"><Switch checked={row.is_active} onCheckedChange={onToggle} /></td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="gold" disabled={!dirty} onClick={async () => { await onSave({ buy_rate: buy, sell_rate: sell, change_24h: chg }); toast.success("Saved"); }}>
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => { if (confirm(`Delete ${row.symbol}?`)) onDelete(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function GiftcardRatesTable() {
  const { data, isLoading } = useGiftcardRates();
  const upsert = useUpsertGiftcardRate();
  const toggle = useToggleRate("giftcard");
  const del = useDeleteRate("giftcard");
  const [draft, setDraft] = useState<Partial<GiftcardRate>>({});

  async function saveNew() {
    if (!draft.brand) return toast.error("Brand required");
    try {
      await upsert.mutateAsync({
        brand: draft.brand,
        category: draft.category ?? "Retail",
        currency: draft.currency ?? "USD",
        card_type: draft.card_type ?? "Physical",
        buy_rate: Number(draft.buy_rate ?? 0),
        sell_rate: Number(draft.sell_rate ?? 0),
        is_active: true,
      });
      setDraft({});
      toast.success("Added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Add new</p>
        <div className="grid gap-2 md:grid-cols-7">
          <Input placeholder="Brand" value={draft.brand ?? ""} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />
          <Input placeholder="Category" value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
          <Input placeholder="Currency" value={draft.currency ?? ""} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} />
          <Input placeholder="Type (Physical/E-code)" value={draft.card_type ?? ""} onChange={(e) => setDraft({ ...draft, card_type: e.target.value })} />
          <Input type="number" placeholder="Buy ₦" value={draft.buy_rate ?? ""} onChange={(e) => setDraft({ ...draft, buy_rate: Number(e.target.value) })} />
          <Input type="number" placeholder="Sell ₦" value={draft.sell_rate ?? ""} onChange={(e) => setDraft({ ...draft, sell_rate: Number(e.target.value) })} />
          <Button variant="gold" onClick={saveNew} disabled={upsert.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Brand</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Currency</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Buy ₦</th>
                <th className="px-3 py-3">Sell ₦</th>
                <th className="px-3 py-3">Active</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>}
              {(data ?? []).map((r) => (
                <GiftRow key={r.id} row={r} onSave={(patch) => upsert.mutateAsync({ ...r, ...patch })} onToggle={(v) => toggle.mutate({ id: r.id, is_active: v })} onDelete={() => del.mutate(r.id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GiftRow({
  row,
  onSave,
  onToggle,
  onDelete,
}: {
  row: GiftcardRate;
  onSave: (patch: Partial<GiftcardRate>) => Promise<unknown>;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const [buy, setBuy] = useState(row.buy_rate);
  const [sell, setSell] = useState(row.sell_rate);
  const dirty = buy !== row.buy_rate || sell !== row.sell_rate;
  return (
    <tr className="hover:bg-secondary/30">
      <td className="px-3 py-2 font-bold">{row.brand}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{row.category}</td>
      <td className="px-3 py-2">{row.currency}</td>
      <td className="px-3 py-2 text-xs">{row.card_type}</td>
      <td className="px-3 py-2"><Input type="number" className="h-8 w-24" value={buy} onChange={(e) => setBuy(Number(e.target.value))} /></td>
      <td className="px-3 py-2"><Input type="number" className="h-8 w-24" value={sell} onChange={(e) => setSell(Number(e.target.value))} /></td>
      <td className="px-3 py-2"><Switch checked={row.is_active} onCheckedChange={onToggle} /></td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="gold" disabled={!dirty} onClick={async () => { await onSave({ buy_rate: buy, sell_rate: sell }); toast.success("Saved"); }}>
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => { if (confirm(`Delete ${row.brand}?`)) onDelete(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
