import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  extractSogoProviderTransactionId,
  extractSogoReference,
  extractSogoStatus,
  sogoRequest,
} from "./client";
import type {
  GiftCardCatalogItem,
  GiftCardRateItem,
  ProviderReferenceResult,
  SogoEnvelope,
} from "./types";

type SogoEnvelopeData = SogoEnvelope<unknown> & {
  data?: unknown;
  result?: unknown;
};

function getEnvelopeList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const container = payload as SogoEnvelopeData | null;
  if (container && Array.isArray(container.data)) return container.data;
  if (container && Array.isArray(container.result)) return container.result;

  return [];
}

function getEnvelopeRecord(payload: unknown): Record<string, unknown> | undefined {
  const container = payload as SogoEnvelopeData | null;
  if (container && typeof container === "object") {
    if (container.data && typeof container.data === "object") return container.data as Record<string, unknown>;
    if (container.result && typeof container.result === "object") return container.result as Record<string, unknown>;
    return container as Record<string, unknown>;
  }
  return undefined;
}

function normalizeGiftCardCatalog(payload: unknown): GiftCardCatalogItem[] {
  const list = getEnvelopeList(payload);

  return (list as unknown[]).map((item: unknown, idx: number) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      id: String(row.id ?? row.code ?? row.brand ?? idx),
      brand: String(row.name ?? "Gift card"),
      name: String(row.name ?? row.brand ?? row.code ?? "Gift card"),
      code: String(row.slug ?? ""),
      slug: String(row.slug ?? ""),
      countries: Array.isArray(row.countries)
        ? row.countries.filter((value): value is string => typeof value === "string")
        : [],
      card_types: Array.isArray(row.card_types)
        ? row.card_types.filter((value): value is string => typeof value === "string")
        : [],
      category: String(row.category ?? row.type ?? "General"),
      currency: String(row.currency ?? ""),
      card_type:
        Array.isArray(row.card_types) && row.card_types.length === 1
          ? String(row.card_types[0])
          : "",
      rate: 0,
      min_amount: Number(row.min_amount ?? row.minAmount ?? 0),
      is_active: Boolean(row.is_active ?? row.isActive ?? true),
    };
  });
}

function normalizeGiftCardRate(payload: unknown): GiftCardRateItem[] {
  const list = getEnvelopeList(payload);

  return (list as unknown[]).map((item: unknown, idx: number) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const rates = row.rates;
    return {
      id: String(row.id ?? row.code ?? row.brand ?? idx),
      brand: String(row.name ?? "Gift card"),
      name: String(row.name ?? "Gift card"),
      code: String(row.slug ?? ""),
      slug: String(row.slug ?? ""),
      rates,
      category: String(row.category ?? row.type ?? "General"),
      currency: "",
      card_type: "",
      rate: 0,
      buy_rate: 0,
      sell_rate: 0,
      payout: 0,
      min_amount: 0,
      is_active: true,
    };
  });
}

export const listGiftCardCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const payload = await sogoRequest<SogoEnvelope<unknown>>("/gift-cards/sell/catalog");
    return normalizeGiftCardCatalog(payload).map((card) => ({
      name: card.name ?? "",
      slug: card.slug ?? "",
      currency: card.currency ?? "USD",
      countries: card.countries ?? [],
      cardTypes: card.card_types ?? [],
      minAmount: Number(card.min_amount ?? 0),
      maxAmount: Number(card.max_amount ?? 0),
    }));
  });

export const listGiftCardRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const payload = await sogoRequest<SogoEnvelope<unknown>>("/gift-cards/sell/rates");
    return normalizeGiftCardRate(payload).map((rate) => ({
      name: rate.name ?? "",
      slug: rate.slug ?? "",
      rates: rate.rates ?? null,
    }));
  });

const giftCardSellSchema = z.object({
  slug: z.string().min(1).max(100),
  cardCountry: z.string().length(2),
  cardType: z.enum(["ecode", "physical"]),
  cardCurrency: z.string().length(3),
  cardAmount: z.number().positive().max(99999),
  additionalInfo: z.string().min(10).max(1000),
  subType: z.string().max(100).optional(),
  specificCountry: z.string().max(100).optional(),
});

export const submitGiftCardSell = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => giftCardSellSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const idempotencyKey = crypto.randomUUID();
    const payload = new FormData();
    payload.set("slug", data.slug);
    payload.set("card_country", data.cardCountry);
    payload.set("card_type", data.cardType);
    payload.set("card_currency", data.cardCurrency);
    payload.set("card_amount", String(data.cardAmount));
    payload.set("additional_info", data.additionalInfo);
    payload.set("payout_currency", "NGN");
    if (data.subType) payload.set("sub_type", data.subType);
    if (data.specificCountry) payload.set("specific_country", data.specificCountry);

    const raw = await sogoRequest<SogoEnvelope<unknown>>("/gift-cards/sell", {
      method: "POST",
      body: payload,
      idempotencyKey,
    });

    const envelopeRecord = getEnvelopeRecord(raw);
    const providerReference =
      extractSogoReference(raw) ?? (envelopeRecord ? extractSogoReference(envelopeRecord) : undefined);
    const providerTransactionId =
      extractSogoProviderTransactionId(raw) ??
      (envelopeRecord ? extractSogoProviderTransactionId(envelopeRecord) : undefined);
    const providerStatus =
      extractSogoStatus(raw) ?? (envelopeRecord ? extractSogoStatus(envelopeRecord) : undefined);
    if (!providerReference) throw new Error("Sogo did not return a transaction reference.");

    const responseData = (envelopeRecord && "data" in envelopeRecord ? envelopeRecord.data : raw) as Record<string, unknown> | null;
    const transaction = responseData && typeof responseData.transaction === "object" ? (responseData.transaction as Record<string, unknown>) : undefined;
    const payoutValue = responseData && "payout_amount" in responseData ? responseData.payout_amount : transaction?.amount;
    const amount = Number(typeof payoutValue === "object" && payoutValue !== null ? (payoutValue as Record<string, unknown>).raw : (payoutValue ?? 0));
    if (!(amount > 0)) throw new Error("Sogo did not return a valid payout amount.");

    const { data: localTransaction, error: transactionError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: context.userId,
        type: "sell",
        category: "giftcard",
        asset: data.slug,
        amount,
        quantity: data.cardAmount,
        status: "pending",
        stage: "submitted",
        reference: providerReference,
        reviewer_notes: providerStatus
          ? `Sogo provider status: ${providerStatus}`
          : "Sogo sell request submitted",
      } as never)
      .select("id")
      .single();
    if (transactionError || !localTransaction?.id)
      throw new Error("Unable to record the gift-card trade.");

    const { error: providerError } = await supabaseAdmin
      .from("sogo_provider_records")
      .upsert(
        {
          user_id: context.userId,
          transaction_id: localTransaction.id,
          operation_type: "gift_card_sell",
          provider_reference: providerReference,
          provider_transaction_id: providerTransactionId ?? null,
          provider_status: providerStatus ?? "pending",
          idempotency_key: idempotencyKey,
        } as never,
        { onConflict: "provider_reference" },
      );
    if (providerError) throw new Error("Unable to record the Sogo trade reference.");

    const result: ProviderReferenceResult = {
      providerReference,
      providerStatus,
      providerTransactionId: transaction && typeof transaction.id !== "undefined" ? String(transaction.id) : undefined,
    };

    return result;
  });
