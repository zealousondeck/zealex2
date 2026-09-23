import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cryptoAssets, giftCards, nairaFormatter } from "@/lib/market-data";
import { cn } from "@/lib/utils";

type Tick = { label: string; value: string; change: number };

function buildTicks(jitter: number): Tick[] {
  const crypto = cryptoAssets.map((c) => ({
    label: c.symbol,
    value: nairaFormatter.format(Math.round(c.buyRate * (1 + jitter * (c.change24h >= 0 ? 1 : -1) * 0.0004))),
    change: +(c.change24h + jitter * 0.02 * (c.change24h >= 0 ? 1 : -1)).toFixed(2),
  }));
  const cards = giftCards.slice(0, 5).map((g) => ({
    label: `${g.brand} ${g.currency}`,
    value: `${nairaFormatter.format(g.ratePerUnit)}/$`,
    change: g.change24h,
  }));
  return [...crypto, ...cards];
}

export function RateTicker() {
  const [ticks, setTicks] = useState<Tick[]>(() => buildTicks(0));

  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setTicks(buildTicks(Math.sin(n / 2) * 1.5 + 1.5));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const row = [...ticks, ...ticks];

  return (
    <div className="relative overflow-hidden border-y border-border/60 bg-ink py-3">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink to-transparent" />
      <div className="flex w-max animate-marquee items-center gap-8 whitespace-nowrap">
        {row.map((t, i) => {
          const up = t.change >= 0;
          return (
            <div key={i} className="flex items-center gap-2.5 text-sm">
              <span className="font-display font-bold text-ink-foreground">{t.label}</span>
              <span className="font-semibold text-ink-foreground/70">{t.value}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold",
                  up ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                )}
              >
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {up ? "+" : ""}
                {t.change}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
