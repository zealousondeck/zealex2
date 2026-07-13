import { useMemo, useState } from "react";
import { ArrowRight, Calculator } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cryptoAssets, giftCards, nairaFormatter } from "@/lib/market-data";
import { cn } from "@/lib/utils";

type Mode = "crypto" | "giftcard";

export function RateCalculator() {
  const [mode, setMode] = useState<Mode>("crypto");
  const [cryptoSymbol, setCryptoSymbol] = useState(cryptoAssets[0].symbol);
  const [cardBrand, setCardBrand] = useState(giftCards[0].brand);
  const [amount, setAmount] = useState("100");

  const { rate, unitLabel, payout } = useMemo(() => {
    const value = parseFloat(amount) || 0;
    if (mode === "crypto") {
      const asset = cryptoAssets.find((c) => c.symbol === cryptoSymbol) ?? cryptoAssets[0];
      return { rate: asset.buyRate, unitLabel: asset.symbol, payout: value * asset.buyRate };
    }
    const card = giftCards.find((c) => c.brand === cardBrand) ?? giftCards[0];
    return { rate: card.ratePerUnit, unitLabel: `${card.currency} value`, payout: value * card.ratePerUnit };
  }, [mode, cryptoSymbol, cardBrand, amount]);

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-card sm:p-7">
      <div className="mb-5 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-soft text-gold-foreground">
          <Calculator className="h-4.5 w-4.5" />
        </span>
        <div>
          <h3 className="font-display text-base font-bold">Rate calculator</h3>
          <p className="text-xs text-muted-foreground">Estimate your payout before you sign up</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
        {(["crypto", "giftcard"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-lg py-2 text-sm font-semibold transition-colors",
              mode === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
            )}
          >
            {m === "crypto" ? "Crypto" : "Gift card"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              {mode === "crypto" ? "Asset" : "Brand"}
            </span>
            {mode === "crypto" ? (
              <Select value={cryptoSymbol} onValueChange={setCryptoSymbol}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cryptoAssets.map((c) => (
                    <SelectItem key={c.symbol} value={c.symbol}>
                      {c.name} ({c.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={cardBrand} onValueChange={setCardBrand}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {giftCards.map((c) => (
                    <SelectItem key={c.brand} value={c.brand}>
                      {c.brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              Amount ({unitLabel})
            </span>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="h-11 font-semibold"
              placeholder="0.00"
            />
          </label>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3 text-sm">
          <span className="text-muted-foreground">Current rate</span>
          <span className="font-semibold">
            {nairaFormatter.format(rate)}
            <span className="text-muted-foreground"> / {mode === "crypto" ? unitLabel : "unit"}</span>
          </span>
        </div>

        <div className="rounded-2xl bg-gradient-ink p-5 text-ink-foreground">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-foreground/60">
            You receive
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold text-gradient-gold">
            {nairaFormatter.format(Math.round(payout))}
          </p>
        </div>

        <Button variant="gold" size="lg" className="w-full">
          Trade now <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Indicative rates. Final rate is locked when you confirm a trade.
        </p>
      </div>
    </div>
  );
}
