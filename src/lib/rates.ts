import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./audit";

export type CryptoRate = {
  id: string;
  symbol: string;
  name: string;
  network: string;
  buy_rate: number;
  sell_rate: number;
  change_24h: number;
  min_amount: number;
  is_active: boolean;
  updated_at: string;
};

export type GiftcardRate = {
  id: string;
  brand: string;
  category: string;
  currency: string;
  card_type: string;
  buy_rate: number;
  sell_rate: number;
  min_amount: number;
  is_active: boolean;
  updated_at: string;
};

const CRYPTO = "crypto_rates" as any;
const GIFT = "giftcard_rates" as any;

export function useCryptoRates() {
  return useQuery({
    queryKey: ["rates", "crypto"],
    queryFn: async (): Promise<CryptoRate[]> => {
      const { data, error } = await supabase
        .from(CRYPTO)
        .select("*")
        .order("symbol");
      if (error) throw error;
      return (data ?? []) as unknown as CryptoRate[];
    },
  });
}

export function useGiftcardRates() {
  return useQuery({
    queryKey: ["rates", "giftcard"],
    queryFn: async (): Promise<GiftcardRate[]> => {
      const { data, error } = await supabase
        .from(GIFT)
        .select("*")
        .order("brand");
      if (error) throw error;
      return (data ?? []) as unknown as GiftcardRate[];
    },
  });
}

export function useUpsertCryptoRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<CryptoRate> & { symbol: string; name: string }) => {
      const { data, error } = await supabase
        .from(CRYPTO)
        .upsert(row as any, { onConflict: "symbol" })
        .select()
        .maybeSingle();
      if (error) throw error;
      await logAudit("rate.crypto.upsert", "crypto_rates", (data as any)?.id, row);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rates"] }),
  });
}

export function useUpsertGiftcardRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<GiftcardRate> & { brand: string }) => {
      const { data, error } = await supabase
        .from(GIFT)
        .upsert(row as any, { onConflict: "brand,currency,card_type" })
        .select()
        .maybeSingle();
      if (error) throw error;
      await logAudit("rate.giftcard.upsert", "giftcard_rates", (data as any)?.id, row);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rates"] }),
  });
}

export function useToggleRate(kind: "crypto" | "giftcard") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const table = kind === "crypto" ? CRYPTO : GIFT;
      const { error } = await supabase.from(table).update({ is_active }).eq("id", id);
      if (error) throw error;
      await logAudit(`rate.${kind}.toggle`, `${kind}_rates`, id, { is_active });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rates"] }),
  });
}

export function useDeleteRate(kind: "crypto" | "giftcard") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const table = kind === "crypto" ? CRYPTO : GIFT;
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      await logAudit(`rate.${kind}.delete`, `${kind}_rates`, id, {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rates"] }),
  });
}
