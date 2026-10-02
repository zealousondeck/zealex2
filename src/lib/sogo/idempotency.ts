import crypto from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ProviderRecord = {
  id: string;
  provider_reference: string | null;
  provider_status: string;
};

const providerRecords = () => (supabaseAdmin as any).from("sogo_provider_records");

export type TradeIntentResult = {
  duplicate: boolean;
  intentKey: string;
  reservationId?: string;
  providerReference?: string;
  providerStatus?: string;
};

export async function updateTradeIntent(
  reservationId: string,
  patch: {
    providerReference?: string;
    providerTransactionId?: string | null;
    providerStatus: string;
    transactionId?: string | null;
  },
) {
  const { error } = await providerRecords()
    .update({
      ...(patch.providerReference ? { provider_reference: patch.providerReference } : {}),
      ...(patch.providerTransactionId !== undefined
        ? { provider_transaction_id: patch.providerTransactionId }
        : {}),
      ...(patch.transactionId !== undefined ? { transaction_id: patch.transactionId } : {}),
      provider_status: patch.providerStatus,
    } as never)
    .eq("id", reservationId);

  if (error) throw error;
}

export async function reserveTradeIntent({
  userId,
  tradeType,
  payload,
}: {
  userId: string;
  tradeType: string;
  payload: Record<string, unknown>;
}): Promise<TradeIntentResult> {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  const intentKey = crypto.createHash("sha256").update(`${userId}:${tradeType}:${normalized}`).digest("hex");
  const reservationReference = `intent:${intentKey}`;

  const reopenFailedReservation = async (reservationId: string) => {
    const { data, error } = await providerRecords()
      .update({
        provider_reference: reservationReference,
        provider_status: "reserved",
      } as never)
      .eq("id", reservationId)
      .eq("provider_status", "failed")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return (data as Pick<ProviderRecord, "id"> | null)?.id;
  };

  const { data: existingData, error: existingError } = await providerRecords()
    .select("id, provider_reference, provider_status")
    .eq("idempotency_key", intentKey)
    .maybeSingle();

  if (existingError) throw existingError;
  const existing = existingData as ProviderRecord | null;

  if (existing) {
    if (existing.provider_status === "failed") {
      const reservationId = await reopenFailedReservation(existing.id);
      if (reservationId) {
        return { duplicate: false, intentKey, reservationId };
      }
    }

    return {
      duplicate: true,
      intentKey,
      reservationId: existing.id,
      providerReference: existing.provider_reference ?? undefined,
      providerStatus: existing.provider_status ?? undefined,
    };
  }

  const { data: reservationData, error: reservationError } = await providerRecords()
    .insert({
      user_id: userId,
      operation_type: tradeType,
      provider_reference: reservationReference,
      provider_status: "reserved",
      idempotency_key: intentKey,
    } as never)
    .select("id")
    .single();

  if (reservationError) {
    if (reservationError.code === "23505") {
      const { data: duplicateData, error: duplicateError } = await providerRecords()
        .select("id, provider_reference, provider_status")
        .eq("idempotency_key", intentKey)
        .single();

      if (duplicateError) throw duplicateError;
      const duplicate = duplicateData as ProviderRecord;
      if (duplicate.provider_status === "failed") {
        const reservationId = await reopenFailedReservation(duplicate.id);
        if (reservationId) {
          return { duplicate: false, intentKey, reservationId };
        }
      }

      return {
        duplicate: true,
        intentKey,
        reservationId: duplicate.id,
        providerReference: duplicate.provider_reference ?? undefined,
        providerStatus: duplicate.provider_status ?? undefined,
      };
    }
    throw reservationError;
  }

  const reservation = reservationData as Pick<ProviderRecord, "id">;

  return {
    duplicate: false,
    intentKey,
    reservationId: reservation.id,
  };
}
