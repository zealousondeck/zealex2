import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeNairaPayout } from "./finance";

/**
 * Gift card exchange — reads the admin-managed `giftcard_rates` table and
 * records trades as real `transactions` rows (category "giftcard"). No
 * third-party provider: the Zealex desk reviews each trade and credits the
 * wallet when it approves the order.
 */

export type GiftCardRate = {
  id: string;
  brand: string;
  category: string;
  currency: string;
  card_type: string;
  buy_rate: number;
  sell_rate: number;
  min_amount: number;
  is_active: boolean;
};

/** Active, admin-managed rates (public read policy). */
export function useGiftCardRates() {
  return useQuery({
    queryKey: ["giftcard-rates"],
    queryFn: async (): Promise<GiftCardRate[]> => {
      const { data, error } = await supabase
        .from("giftcard_rates")
        .select("*")
        .eq("is_active", true)
        .order("brand", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as GiftCardRate[];
    },
  });
}

export type KycGate = {
  status: "none" | "pending" | "approved" | "rejected";
  notes: string | null;
  isLoading: boolean;
};

/** Latest KYC submission status for the signed-in user. */
export function useKycGate(): KycGate {
  return useQuery({
    queryKey: ["kyc", "gate"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return { status: "none" as const, notes: null };
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("id, status, review_notes")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { status: "none" as const, notes: null };
      return {
        status: data.status as "pending" | "approved" | "rejected",
        notes: (data.review_notes as string | null) ?? null,
      };
    },
  });
}

export type GiftCardTrade = {
  id: string;
  asset: string | null;
  amount: number;
  quantity: number | null;
  status: string;
  stage: string;
  reference: string;
  proof_path: string | null;
  reviewer_notes: string | null;
  created_at: string;
};

/** The signed-in user's gift card trades. */
export function useMyGiftCardTrades() {
  return useQuery({
    queryKey: ["transactions", "giftcard", "mine"],
    queryFn: async (): Promise<GiftCardTrade[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, asset, amount, quantity, status, stage, reference, proof_path, reviewer_notes, created_at",
        )
        .eq("user_id", uid)
        .eq("category", "giftcard")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as unknown as GiftCardTrade[];
    },
  });
}

export type GiftCardTradeInput = {
  brand: string;
  currency: string;
  cardType: "Physical" | "E-code";
  country: string;
  amount: number;
  rate: number;
  minAmount: number;
  code: string;
  notes: string;
  file: File | null;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Creates a pending gift card trade: proof upload + real transaction record. */
export function useSubmitGiftCardTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GiftCardTradeInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("You need to be signed in");

      if (!(input.rate > 0)) throw new Error("This card has no published rate yet");
      if (!(input.amount > 0)) throw new Error("Enter a valid card value");
      if (input.minAmount > 0 && input.amount < input.minAmount)
        throw new Error(`Minimum accepted value is ${input.minAmount}`);
      if (!input.country.trim()) throw new Error("Enter the card country");
      if (input.cardType === "E-code" && input.code.trim().length < 10)
        throw new Error("Enter the full redemption code (at least 10 characters)");
      if (input.cardType === "Physical" && input.notes.trim().length < 10)
        throw new Error("Describe the card in at least 10 characters");
      if (input.cardType === "Physical" && !input.file)
        throw new Error("Upload a clear photo of the gift card");
      if (
        input.file &&
        input.file.size > MAX_FILE_BYTES
      )
        throw new Error("Image must be 5 MB or smaller");

      // KYC must be approved before trading.
      const { data: kyc, error: kycError } = await supabase
        .from("kyc_submissions")
        .select("status")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (kycError) throw new Error("Could not confirm your verification status");
      if (!kyc) throw new Error("Complete identity verification before trading — visit the KYC page");
      if (kyc.status !== "approved")
        throw new Error(
          kyc.status === "pending"
            ? "Your identity verification is still under review"
            : "Your identity verification was not approved — visit the KYC page",
        );

      const payout = computeNairaPayout(input.amount, input.rate);
      if (!(payout > 0)) throw new Error("Rate unavailable — please try again shortly");

      let proofPath: string | null = null;
      if (input.file) {
        const ext =
          input.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${uid}/giftcard/${Date.now()}.${ext}`;
        try {
          const { error } = await supabase.storage.from("Trades").upload(path, input.file, {
            upsert: false,
          });
          if (error) {
            console.warn("[GiftCard] image upload failed; continuing with manual review", {
              error: error.message,
              path,
              userId: uid,
            });
            proofPath = "pending_manual_upload";
          } else {
            proofPath = path;
          }
        } catch (error) {
          console.warn("[GiftCard] image upload crashed; continuing with manual review", {
            error: error instanceof Error ? error.message : String(error),
            path,
            userId: uid,
          });
          proofPath = "pending_manual_upload";
        }
      }

      const reference = `GC-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;

      const notes = [
        `Currency: ${input.currency}`,
        `Card type: ${input.cardType}`,
        `Country: ${input.country.trim().toUpperCase()}`,
        input.cardType === "E-code" ? `Redemption code: ${input.code.trim()}` : null,
        input.cardType === "Physical" ? `Card notes: ${input.notes.trim()}` : null,
        `Quoted rate: ₦${Math.round(input.rate).toLocaleString()} per ${input.currency} unit`,
      ]
        .filter(Boolean)
        .join(" · ");

      const { error: txError } = await supabase.from("transactions").insert({
        user_id: uid,
        type: "sell",
        category: "giftcard",
        asset: input.brand,
        amount: payout,
        quantity: input.amount,
        status: "pending",
        stage: "submitted",
        reference,
        proof_path: proofPath,
        reviewer_notes: notes,
      } as never);
      if (txError) throw txError;

      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: uid,
        title: "Gift card trade submitted",
        body: `Your ${input.brand} card (${input.currency} ${input.amount}) is under review. Reference ${reference}.`,
        category: "trade",
      });
      if (notificationError) throw notificationError;

      return { reference, payout };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
