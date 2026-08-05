import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import {
  SUPPORTED_COINS,
  MARGINS_KEY,
  WALLETS_KEY,
  useCryptoMargins,
  useCryptoMarket,
  useDepositWallets,
  useSaveCryptoSetting,
  buildQuote,
} from "@/lib/crypto-exchange";
import { nairaFormatter } from "@/lib/market-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Admin console: profit margin (%) per coin + deposit wallet addresses per network. */
export function CryptoMarginPanel() {
  const { margins } = useCryptoMargins();
  const wallets = useDepositWallets();
  const market = useCryptoMarket();
  const save = useSaveCryptoSetting();

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [addr, setAddr] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(Object.fromEntries(SUPPORTED_COINS.map((c) => [c.symbol, String(margins[c.symbol] ?? 0)])));
  }, [JSON.stringify(margins)]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const c of SUPPORTED_COINS)
      for (const n of c.networks) next[`${c.symbol}:${n}`] = wallets[`${c.symbol}:${n}`] ?? "";
    setAddr(next);
  }, [JSON.stringify(wallets)]);

  async function saveMargins() {
    const payload: Record<string, number> = {};
    for (const c of SUPPORTED_COINS) {
      const v = Number(draft[c.symbol]);
      if (!Number.isFinite(v) || v < 0 || v > 50) return toast.error(`Invalid margin for ${c.symbol}`);
      payload[c.symbol] = v;
    }
    try {
      await save.mutateAsync({ key: MARGINS_KEY, value: payload });
      toast.success("Margins updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save margins");
    }
  }

  async function saveWallets() {
    try {
      await save.mutateAsync({ key: WALLETS_KEY, value: addr });
      toast.success("Deposit addresses updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save addresses");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold">Profit margin per coin</h2>
            <p className="text-sm text-muted-foreground">
              Zealex buying rate = live market NGN price minus this percentage.
            </p>
          </div>
          <Button variant="gold" onClick={saveMargins} disabled={save.isPending}>
            <Save className="mr-2 h-4 w-4" /> Save margins
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SUPPORTED_COINS.map((c) => {
            const q = buildQuote({
              symbol: c.symbol,
              amount: 1,
              prices: market.data?.prices,
              margins: { ...margins, [c.symbol]: Number(draft[c.symbol] ?? margins[c.symbol] ?? 0) },
            });
            return (
              <div key={c.symbol} className="rounded-xl border border-border bg-secondary/30 p-3">
                <Label htmlFor={`m-${c.symbol}`} className="text-xs font-bold uppercase">
                  {c.name} ({c.symbol})
                </Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    id={`m-${c.symbol}`}
                    type="number"
                    min="0"
                    max="50"
                    step="0.1"
                    value={draft[c.symbol] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [c.symbol]: e.target.value }))}
                  />
                  <span className="text-sm font-bold text-muted-foreground">%</span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Market {q.marketNgn > 0 ? nairaFormatter.format(q.marketNgn) : "—"} · Zealex{" "}
                  <span className="font-bold text-gold">
                    {q.zealexRate > 0 ? nairaFormatter.format(q.zealexRate) : "—"}
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold">Deposit wallet addresses</h2>
            <p className="text-sm text-muted-foreground">
              Shown to users when they sell on the matching network.
            </p>
          </div>
          <Button variant="outline" onClick={saveWallets} disabled={save.isPending}>
            <Save className="mr-2 h-4 w-4" /> Save addresses
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SUPPORTED_COINS.flatMap((c) =>
            c.networks.map((n) => {
              const key = `${c.symbol}:${n}`;
              return (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`a-${key}`} className="text-xs font-bold uppercase">
                    {c.symbol} · {n}
                  </Label>
                  <Input
                    id={`a-${key}`}
                    placeholder="Wallet address"
                    value={addr[key] ?? ""}
                    onChange={(e) => setAddr((a) => ({ ...a, [key]: e.target.value }))}
                  />
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
