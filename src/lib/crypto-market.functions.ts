import { createServerFn } from "@tanstack/react-start";

export type MarketPrice = {
  id: string;
  symbol: string;
  usd: number;
  ngn: number;
  change24h: number;
};

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  BNB: "binancecoin",
  SOL: "solana",
};

/** Live market prices (USD + NGN) from CoinGecko, fetched server-side to avoid CORS/rate-limit leaks. */
export const getCryptoMarket = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ prices: MarketPrice[]; fetchedAt: string; stale: boolean }> => {
    const ids = Object.values(COINGECKO_IDS).join(",");
    const url =
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}` +
      `&vs_currencies=usd,ngn&include_24hr_change=true`;

    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);
      const json = (await res.json()) as Record<
        string,
        { usd?: number; ngn?: number; usd_24h_change?: number }
      >;

      const prices: MarketPrice[] = Object.entries(COINGECKO_IDS).map(([symbol, id]) => ({
        id,
        symbol,
        usd: Number(json[id]?.usd ?? 0),
        ngn: Number(json[id]?.ngn ?? 0),
        change24h: Number(json[id]?.usd_24h_change ?? 0),
      }));

      return { prices, fetchedAt: new Date().toISOString(), stale: false };
    } catch {
      // Never break the UI on an upstream outage — the caller falls back to admin rates.
      return { prices: [], fetchedAt: new Date().toISOString(), stale: true };
    }
  },
);
