import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCryptoMarket, type MarketPrice } from "./crypto-market.functions";
import { useAppSettings, useUpdateSetting } from "./settings";

export type SupportedCoin = {
  symbol: string;
  name: string;
  networks: string[];
  decimals: number;
};

/** Assets Zealex buys, with the networks we accept for each. */
export const SUPPORTED_COINS: SupportedCoin[] = [
  { symbol: "BTC", name: "Bitcoin", networks: ["Bitcoin"], decimals: 8 },
  { symbol: "ETH", name: "Ethereum", networks: ["ERC20"], decimals: 6 },
  { symbol: "USDT", name: "Tether", networks: ["TRC20", "ERC20", "BEP20"], decimals: 2 },
  { symbol: "BNB", name: "BNB", networks: ["BEP20"], decimals: 4 },
  { symbol: "SOL", name: "Solana", networks: ["Solana"], decimals: 4 },
];

export const MARGINS_KEY = "crypto_margins";
export const WALLETS_KEY = "crypto_deposit_wallets";

export const DEFAULT_MARGINS: Record<string, number> = {
  BTC: 3,
  ETH: 3,
  USDT: 2.5,
  BNB: 3.5,
  SOL: 3.5,
};

export type Quote = {
  marketNgn: number;
  zealexRate: number;
  payout: number;
  margin: number;
  live: boolean;
};

/** Live market prices, refreshed every 60s. */
export function useCryptoMarket() {
  const fetchMarket = useServerFn(getCryptoMarket);
  return useQuery({
    queryKey: ["crypto", "market"],
    queryFn: () => fetchMarket(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Admin-configured profit margin (%) per coin. */
export function useCryptoMargins() {
  const { data, isLoading } = useAppSettings();
  const raw = (data?.[MARGINS_KEY] ?? {}) as Record<string, unknown>;
  const margins: Record<string, number> = { ...DEFAULT_MARGINS };
  for (const coin of SUPPORTED_COINS) {
    const v = Number(raw[coin.symbol]);
    if (Number.isFinite(v)) margins[coin.symbol] = v;
  }
  return { margins, isLoading };
}

/** Admin-configured deposit wallet address per network. */
export function useDepositWallets() {
  const { data } = useAppSettings();
  return (data?.[WALLETS_KEY] ?? {}) as Record<string, string>;
}

export function useSaveCryptoSetting() {
  return useUpdateSetting();
}

/** Zealex buying rate = live NGN market price minus the configured margin. */
export function buildQuote({
  symbol,
  amount,
  prices,
  margins,
  fallbackRate,
}: {
  symbol: string;
  amount: number;
  prices: MarketPrice[] | undefined;
  margins: Record<string, number>;
  fallbackRate?: number;
}): Quote {
  const live = prices?.find((p) => p.symbol === symbol);
  const marketNgn = live?.ngn && live.ngn > 0 ? live.ngn : (fallbackRate ?? 0);
  const margin = margins[symbol] ?? 0;
  const zealexRate = marketNgn * (1 - margin / 100);
  return {
    marketNgn,
    zealexRate,
    payout: zealexRate * (Number.isFinite(amount) ? amount : 0),
    margin,
    live: Boolean(live?.ngn && live.ngn > 0),
  };
}

export type CryptoOrderInput = {
  symbol: string;
  network: string;
  amount: number;
  payout: number;
  rate: number;
  txHash: string;
  proof: File | null;
};

/** Creates a pending crypto sell order (no wallet credit until an admin approves). */
export function useSubmitCryptoOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CryptoOrderInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("You need to be signed in");
      if (input.amount <= 0) throw new Error("Enter a valid amount");
      if (input.payout <= 0) throw new Error("Rate unavailable — please try again shortly");
      if (!input.txHash.trim() && !input.proof)
        throw new Error("Add a transaction hash or upload proof of transfer");

      let proofPath: string | null = null;
      if (input.proof) {
        const ext = input.proof.name.split(".").pop() ?? "jpg";
        const path = `${uid}/crypto/${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from("kyc-documents")
          .upload(path, input.proof, { upsert: false });
        if (error) {
          console.error("[Crypto] proof upload failed", { error, path, userId: uid });
          throw error;
        }
        proofPath = path;
      }

      const reference = `CX-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;

      const notes = [
        `Network: ${input.network}`,
        input.txHash.trim() ? `Tx hash: ${input.txHash.trim()}` : null,
        `Quoted rate: ₦${Math.round(input.rate).toLocaleString()} / ${input.symbol}`,
      ]
        .filter(Boolean)
        .join(" · ");

      const { error: txError } = await supabase.from("transactions").insert({
        user_id: uid,
        type: "sell",
        category: "crypto",
        asset: input.symbol,
        amount: Math.round(input.payout),
        quantity: input.amount,
        status: "pending",
        stage: "submitted",
        reference,
        proof_path: proofPath,
        reviewer_notes: notes,
      } as never);
      if (txError) {
        console.error("[Crypto] transaction insert failed", {
          error: txError,
          reference,
          userId: uid,
        });
        throw txError;
      }

      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: uid,
        title: "Crypto order submitted",
        body: `Your ${input.amount} ${input.symbol} (${input.network}) order is under review. Reference ${reference}.`,
        category: "trade",
      });
      if (notificationError) {
        console.error("[Crypto] notification insert failed", {
          error: notificationError,
          reference,
          userId: uid,
        });
        throw notificationError;
      }

      return { reference };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["crypto", "orders"] });
    },
  });
}

export type CryptoOrder = {
  id: string;
  asset: string;
  amount: number;
  quantity: number | null;
  status: string;
  stage: string;
  reference: string;
  reviewer_notes: string | null;
  created_at: string;
};

/** The signed-in user's crypto orders. */
export function useMyCryptoOrders() {
  return useQuery({
    queryKey: ["crypto", "orders"],
    queryFn: async (): Promise<CryptoOrder[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("id, asset, amount, quantity, status, stage, reference, reviewer_notes, created_at")
        .eq("user_id", uid)
        .eq("category", "crypto")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as unknown as CryptoOrder[];
    },
  });
}
