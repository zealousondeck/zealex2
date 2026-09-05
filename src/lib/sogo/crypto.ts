import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractSogoReference, extractSogoStatus, sogoRequest } from "./client";
import type { CryptoAssetItem, ProviderReferenceResult, SogoEnvelope } from "./types";

function normalizeAsset(payload: unknown): CryptoAssetItem[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.data)
      ? (payload as any).data
      : Array.isArray((payload as any)?.result)
        ? (payload as any).result
        : [];

  return (list as unknown[]).map((item: unknown, idx: number) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const symbol = String(row.symbol ?? row.asset ?? row.code ?? `ASSET-${idx}`);
    const networks = Array.isArray(row.networks)
      ? row.networks.filter((value): value is string => typeof value === "string")
      : [String(row.network ?? row.chain ?? "")].filter(Boolean);

    return {
      id: String(row.id ?? row.asset ?? symbol),
      symbol,
      asset: String(row.asset ?? symbol),
      name: String(row.name ?? row.asset ?? symbol),
      network: String(row.network ?? networks[0] ?? ""),
      networks,
      currency: String(row.currency ?? "NGN"),
      rate: Number(row.rate ?? row.buy_rate ?? row.sell_rate ?? 0),
      buy_rate: Number(row.buy_rate ?? row.buyRate ?? row.rate ?? 0),
      sell_rate: Number(row.sell_rate ?? row.sellRate ?? row.rate ?? 0),
      is_active: Boolean(row.is_active ?? row.isActive ?? true),
    };
  });
}

export const listCryptoAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const payload = await sogoRequest<SogoEnvelope<unknown>>("/crypto/assets");
    return normalizeAsset(payload).map((asset) => ({
      symbol: asset.symbol ?? "",
      name: asset.name ?? "",
      networks: asset.networks ?? [],
      defaultNetwork: asset.network ?? "",
      minDepositUsd: Number(asset.min_deposit_usd ?? 0),
    }));
  });

const cryptoRateSchema = z.object({ asset: z.string().min(1).max(10), amount: z.number().positive().max(1_000_000_000).optional() });

export const getCryptoRate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => cryptoRateSchema.parse(data))
  .handler(async ({ data: input }) => {
    const asset = encodeURIComponent(String(input.asset));
    const params: Record<string, string | number | undefined> = { amount: input.amount || 1 };
    const payload = await sogoRequest<SogoEnvelope<unknown>>(`/crypto/assets/${asset}/rate`, { params });
    const row = (payload as any)?.data ?? (payload as any)?.result ?? payload;
    return {
      asset: String((row as any)?.asset ?? input.asset),
      symbol: String((row as any)?.symbol ?? input.asset),
      network: String((row as any)?.network ?? ""),
      rate: Number((row as any)?.rate ?? (row as any)?.buy_rate ?? (row as any)?.sell_rate ?? 0),
      payout: Number((row as any)?.payout ?? 0),
    };
  });

const depositAddressSchema = z.object({ asset: z.string().min(1).max(10), network: z.string().max(30).optional() });

export const generateCryptoDepositAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => depositAddressSchema.parse(data))
  .handler(async ({ data: input, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const idempotencyKey = crypto.randomUUID();
    const raw = await sogoRequest<SogoEnvelope<unknown>>("/crypto/deposit-address", {
      method: "POST",
      body: {
        asset: input.asset,
        network: input.network,
      },
      idempotencyKey,
    });

    const payload = (raw as any)?.data ?? (raw as any)?.result ?? raw;
    const providerReference = extractSogoReference(raw) ?? extractSogoReference(payload);
    const providerStatus = extractSogoStatus(raw) ?? extractSogoStatus(payload);
    const address = String(
      (payload as any)?.address ??
        (payload as any)?.wallet_address ??
        (payload as any)?.deposit_address ??
        "",
    );
    if (!address) throw new Error("Sogo did not return a deposit address.");
    if (!providerReference) throw new Error("Sogo did not return an address reference.");

    await (supabaseAdmin as any).from("sogo_provider_records").upsert(
      {
        user_id: context.userId,
        operation_type: "crypto_deposit_address",
        provider_reference: providerReference,
        provider_status: providerStatus ?? "active",
        idempotency_key: idempotencyKey,
      } as never,
      { onConflict: "provider_reference" },
    );

    return {
      address,
      providerReference,
      providerStatus,
    };
  });

const testDepositSchema = z.object({
  asset: z.string().min(1).max(10),
  network: z.string().max(30).optional(),
  amount: z.number().positive().max(1_000_000_000),
  testReference: z.string().min(4).max(100),
});

export const submitSandboxTestDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => testDepositSchema.parse(data))
  .handler(async ({ data: input }) => {
    const idempotencyKey = crypto.randomUUID();
    const raw = await sogoRequest<SogoEnvelope<unknown>>("/crypto/test-deposit", {
      method: "POST",
      body: {
        asset: input.asset,
        network: input.network ?? "",
        crypto_amount: input.amount ?? 0,
        test_reference: input.testReference,
      },
      idempotencyKey,
    });

    const providerReference = extractSogoReference(raw) ?? extractSogoReference((raw as any)?.data ?? (raw as any)?.result);
    const providerStatus = extractSogoStatus(raw) ?? extractSogoStatus((raw as any)?.data ?? (raw as any)?.result);
    const result: ProviderReferenceResult = {
      providerReference,
      providerStatus,
    };
    return result;
  });
