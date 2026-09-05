import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  Copy,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import {
  SUPPORTED_COINS,
  buildQuote,
  useCryptoMargins,
  useCryptoMarket,
  useMyCryptoOrders,
  useSubmitCryptoOrder,
} from "@/lib/crypto-exchange";
import {
  generateCryptoDepositAddress,
  getCryptoRate,
  listCryptoAssets,
} from "@/lib/sogo/crypto";
import { useCryptoRates } from "@/lib/rates";
import { nairaFormatter } from "@/lib/market-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StageTracker } from "@/components/dashboard/StageTracker";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/crypto")({
  component: CryptoExchangePage,
  head: () => ({
    meta: [
      { title: "Sell Crypto · Zealex Exchange" },
      {
        name: "description",
        content:
          "Sell BTC, ETH, USDT (TRC20/ERC20/BEP20), BNB and SOL at live Zealex rates and get paid in Naira.",
      },
      { property: "og:title", content: "Sell Crypto · Zealex Exchange" },
      {
        property: "og:description",
        content: "Live crypto rates, instant Naira payouts, verified by the Zealex desk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type CryptoAssetOption = {
  symbol: string;
  name: string;
  networks: string[];
  network?: string;
  rate?: number;
};

function CryptoExchangePage() {
  const market = useCryptoMarket();
  const { margins } = useCryptoMargins();
  const { data: adminRates } = useCryptoRates();
  const orders = useMyCryptoOrders();
  const submit = useSubmitCryptoOrder();
  const fetchAssets = useServerFn(listCryptoAssets as any);
  const fetchRate = useServerFn(getCryptoRate as any);
  const generateAddress = useServerFn(generateCryptoDepositAddress as any);

  const assetsQuery = useQuery({
    queryKey: ["sogo", "crypto", "assets"],
    queryFn: () => fetchAssets({ data: undefined }),
  });

  const fallbackAssets = SUPPORTED_COINS.map((coin) => ({
    symbol: coin.symbol,
    name: coin.name,
    networks: coin.networks,
    network: coin.networks[0],
    rate: 0,
  }));

  const assetList: CryptoAssetOption[] =
    Array.isArray(assetsQuery.data) && assetsQuery.data.length > 0
      ? (assetsQuery.data as CryptoAssetOption[])
      : fallbackAssets;

  const [symbol, setSymbol] = useState<string>(assetList[0]?.symbol ?? SUPPORTED_COINS[0].symbol);
  const [network, setNetwork] = useState<string>(
    assetList.find((item) => item.symbol === (assetList[0]?.symbol ?? SUPPORTED_COINS[0].symbol))?.networks?.[0] ??
      SUPPORTED_COINS[0].networks[0],
  );
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);

  const coin = assetList.find((c) => c.symbol === symbol) ?? assetList[0] ?? {
    symbol: SUPPORTED_COINS[0].symbol,
    name: SUPPORTED_COINS[0].name,
    networks: SUPPORTED_COINS[0].networks,
  };
  const prices = market.data?.prices;
  const priceRow = prices?.find((p) => p.symbol === symbol);
  const fallbackRate = adminRates?.find((r) => r.symbol === symbol)?.buy_rate;

  const rateQuery = useQuery({
    queryKey: ["sogo", "crypto", "rate", symbol, amount],
    enabled: Boolean(symbol),
    queryFn: () => fetchRate({ data: { asset: symbol, amount: Number(amount) || 1 } }),
  });

  const sogoRate = Number(rateQuery.data?.rate ?? 0);

  const quote = useMemo(
    () =>
      buildQuote({
        symbol,
        amount: Number(amount) || 0,
        prices,
        margins,
        fallbackRate: fallbackRate ? Number(fallbackRate) : undefined,
      }),
    [symbol, amount, prices, margins, fallbackRate],
  );

  const effectiveQuote = useMemo(
    () =>
      sogoRate > 0
        ? {
            ...quote,
            zealexRate: sogoRate,
            payout: sogoRate * (Number(amount) || 0),
            live: true,
          }
        : quote,
    [amount, quote, sogoRate],
  );

  const [sogoAddress, setSogoAddress] = useState("");
  const address = sogoAddress;

  function pickCoin(next: string) {
    const c = assetList.find((x) => x.symbol === next) ?? assetList[0] ?? {
      symbol: SUPPORTED_COINS[0].symbol,
      name: SUPPORTED_COINS[0].name,
      networks: SUPPORTED_COINS[0].networks,
    };
    setSymbol(c.symbol ?? SUPPORTED_COINS[0].symbol);
    setNetwork((c.networks ?? [SUPPORTED_COINS[0].networks[0]])[0] ?? SUPPORTED_COINS[0].networks[0]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await submit.mutateAsync({
        symbol,
        network,
        amount: Number(amount) || 0,
        payout: effectiveQuote.payout,
        rate: effectiveQuote.zealexRate,
        txHash,
        proof,
      });
      toast.success(`Order ${res.reference} submitted — our desk is reviewing it`);
      setAmount("");
      setTxHash("");
      setProof(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit order");
    }
  }

  async function handleGenerateAddress() {
    try {
      setAddressLoading(true);
      const result = await generateAddress({ data: { asset: symbol, network } });
      if (result.address) {
        setSogoAddress(result.address);
        toast.success("Sogo deposit address generated");
      } else {
        toast.error("Unable to generate a deposit address right now.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate deposit address.");
    } finally {
      setAddressLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Crypto Exchange
          </h1>
          <p className="text-sm text-muted-foreground">
            Sell BTC, ETH, USDT, BNB and SOL at live rates — paid straight to your Naira wallet.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => market.refetch()}
          disabled={market.isFetching}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", market.isFetching && "animate-spin")} />
          {market.isFetching ? "Refreshing" : "Refresh rates"}
        </Button>
      </header>

      {/* Live ticker */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SUPPORTED_COINS.map((c) => {
          const p = prices?.find((x) => x.symbol === c.symbol);
          const q = buildQuote({
            symbol: c.symbol,
            amount: 1,
            prices,
            margins,
            fallbackRate: Number(adminRates?.find((r) => r.symbol === c.symbol)?.buy_rate ?? 0),
          });
          const up = (p?.change24h ?? 0) >= 0;
          return (
            <button
              key={c.symbol}
              type="button"
              onClick={() => pickCoin(c.symbol)}
              className={cn(
                "rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md",
                symbol === c.symbol ? "border-gold ring-1 ring-gold/40" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-extrabold">{c.symbol}</span>
                <span
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-bold",
                    up ? "text-success" : "text-destructive",
                  )}
                >
                  {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {(p?.change24h ?? 0).toFixed(2)}%
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-gold">
                {q.zealexRate > 0 ? nairaFormatter.format(q.zealexRate) : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {p?.usd ? `${usd.format(p.usd)} market` : "Awaiting live price"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl border border-border bg-card p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Coin</Label>
              <Select value={symbol} onValueChange={pickCoin}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_COINS.map((c) => (
                    <SelectItem key={c.symbol} value={c.symbol}>
                      {c.name} ({c.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Network</Label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {coin.networks.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ({symbol})</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-border bg-secondary/50 p-4">
            <Row
              label="Live market value"
              value={quote.marketNgn > 0 ? nairaFormatter.format(quote.marketNgn) : "—"}
              hint={priceRow?.usd ? `${usd.format(priceRow.usd)} / ${symbol}` : undefined}
            />
            <Row
              label={`Zealex buying rate (−${quote.margin}% margin)`}
              value={effectiveQuote.zealexRate > 0 ? nairaFormatter.format(effectiveQuote.zealexRate) : "—"}
            />
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">Estimated payout</span>
              <span className="font-display text-xl font-extrabold text-gold">
                {nairaFormatter.format(effectiveQuote.payout)}
              </span>
            </div>
            {!quote.live && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Live feed unavailable — showing the desk rate. Final payout is confirmed on review.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end">
            <Button type="button" variant="outline" size="sm" onClick={handleGenerateAddress} disabled={addressLoading}>
              {addressLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate deposit address
            </Button>
          </div>

          {address && (
            <div className="rounded-xl border border-dashed border-gold/50 bg-gold-soft/40 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Send {symbol} on {network} to
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 break-all text-xs font-semibold">{address}</code>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(address);
                    toast.success("Address copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="hash">Transaction hash</Label>
            <Input
              id="hash"
              placeholder="0x… or TRON tx id"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proof">Proof of transfer (optional if hash provided)</Label>
            <label
              htmlFor="proof"
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-3 text-sm transition-colors hover:border-gold"
            >
              <UploadCloud className="h-4 w-4 text-gold" />
              <span className="truncate text-muted-foreground">
                {proof ? proof.name : "Upload screenshot or receipt"}
              </span>
            </label>
            <input
              id="proof"
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button
            type="submit"
            variant="gold"
            className="w-full font-bold"
            disabled={submit.isPending}
          >
            {submit.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
              </>
            ) : (
              <>
                Submit crypto order <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Orders are credited to your wallet after the Zealex desk confirms the transfer on-chain.
          </p>
        </form>

        <aside className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-gold" />
            <h2 className="font-display text-lg font-extrabold">Your crypto orders</h2>
          </div>
          {orders.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!orders.isLoading && (orders.data ?? []).length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No crypto orders yet.
            </p>
          )}
          <ul className="space-y-3">
            {(orders.data ?? []).map((o) => (
              <li key={o.id} className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">
                      {o.quantity ?? "—"} {o.asset}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{o.reference}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gold">
                      {nairaFormatter.format(Number(o.amount))}
                    </p>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">
                      {o.status}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <StageTracker stage={o.stage} compact />
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">
        {value}
        {hint && (
          <span className="block text-[11px] font-normal text-muted-foreground">{hint}</span>
        )}
      </span>
    </div>
  );
}
