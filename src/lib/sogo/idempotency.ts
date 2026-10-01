import crypto from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  const { error } = await supabaseAdmin
    .from("sogo_provider_records")
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
    const { data, error } = await supabaseAdmin
      .from("sogo_provider_records")
      .update({
        provider_reference: reservationReference,
        provider_status: "reserved",
      } as never)
      .eq("id", reservationId)
      .eq("provider_status", "failed")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return data?.id;
  };

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("sogo_provider_records")
    .select("id, provider_reference, provider_status")
    .eq("idempotency_key", intentKey)
    .maybeSingle();

  if (existingError) throw existingError;

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

  const { data: reservation, error: reservationError } = await supabaseAdmin
    .from("sogo_provider_records")
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
      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from("sogo_provider_records")
        .select("id, provider_reference, provider_status")
        .eq("idempotency_key", intentKey)
        .single();

      if (duplicateError) throw duplicateError;
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

  return {
    duplicate: false,
    intentKey,
    reservationId: reservation.id,
  };
}
