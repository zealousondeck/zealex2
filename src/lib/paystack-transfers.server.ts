/** Server-only Paystack payout helpers (recipients + transfers). Never imported by client code. */

import { paystackSecret } from "./banking.server";

export type TransferOutcome = {
  /** "success" means money already moved; "pending" means Paystack accepted the transfer. */
  status: "success" | "pending" | "failed";
  recipientCode?: string;
  transferCode?: string;
  transferReference?: string;
  message?: string;
};

function assertKobo(amountNaira: number): number {
  const kobo = Math.round(amountNaira * 100);
  if (!Number.isFinite(kobo) || kobo <= 0) throw new Error("Invalid transfer amount");
  return kobo;
}

async function paystackFetch(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; payload: (Record<string, unknown> & { data?: unknown }) | null }> {
  let res: Response;
  try {
    res = await fetch(`https://api.paystack.co${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${paystackSecret()}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Could not reach the payment provider — please retry");
  }
  const payload = (await res.json().catch(() => null)) as (Record<string, unknown> & {
    data?: unknown;
  }) | null;
  return { ok: res.ok, status: res.status, payload };
}

/** Best-effort match of a stored bank name to a Paystack bank code. */
export async function resolveBankCode(bankName: string): Promise<string | null> {
  const { fetchNigerianBanks } = await import("./banking.server");
  const banks = await fetchNigerianBanks();
  const target = bankName.trim().toLowerCase();
  if (!target) return null;
  const exact = banks.find((b) => b.name.toLowerCase() === target);
  if (exact) return exact.code;
  // Both directions of containment: stored names are sometimes longer
  // ("Opay Digital Services Limited (OPay)") than Paystack's ("OPay").
  const contains = banks.find(
    (b) => b.name.toLowerCase().includes(target) || target.includes(b.name.toLowerCase()),
  );
  return contains?.code ?? null;
}

/** Creates (or reuses) a Paystack transfer recipient for a Nigerian bank account. */
export async function createRecipient(opts: {
  accountName: string;
  accountNumber: string;
  bankCode: string;
}): Promise<string> {
  const { ok, status, payload } = await paystackFetch("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: opts.accountName,
      account_number: opts.accountNumber,
      bank_code: opts.bankCode,
      currency: "NGN",
    }),
  });
  const data = payload?.data as { recipient_code?: string } | undefined;
  if (ok && payload?.status !== false && data?.recipient_code) return data.recipient_code;
  const message = String(payload?.message ?? "Could not register the payout account");
  if (status === 401 || status === 403) {
    throw new Error("Payout services are misconfigured on the server — contact support");
  }
  throw new Error(message);
}

/** Initiates a real Paystack transfer from the balance the secret key owns. */
export async function initiateTransfer(opts: {
  amountNaira: number;
  recipientCode: string;
  reference: string;
  reason?: string;
}): Promise<TransferOutcome> {
  const { ok, status, payload } = await paystackFetch("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: assertKobo(opts.amountNaira),
      recipient: opts.recipientCode,
      reference: opts.reference.slice(0, 100),
      reason: (opts.reason ?? "Zealex withdrawal").slice(0, 100),
      currency: "NGN",
    }),
  });
  const data = payload?.data as
    | { transfer_code?: string; transfer_status?: string; status?: string }
    | undefined;
  if (ok && payload?.status !== false && data) {
    const transferStatus = String(data.transfer_status ?? data.status ?? "pending").toLowerCase();
    return {
      status: transferStatus === "success" ? "success" : "pending",
      recipientCode: opts.recipientCode,
      transferCode: data.transfer_code,
      transferReference: opts.reference.slice(0, 100),
    };
  }
  const message = String(payload?.message ?? "The payment provider rejected this transfer");
  if (status === 401 || status === 403) {
    throw new Error("Payout services are misconfigured on the server — contact support");
  }
  return { status: "failed", message };
}

/** Reads the latest status of a transfer from the provider. */
export async function verifyTransfer(
  transferCodeOrReference: string,
): Promise<{ status: "success" | "pending" | "failed"; message?: string; code?: string }> {
  const { ok, payload } = await paystackFetch(
    `/transfer/${encodeURIComponent(transferCodeOrReference)}`,
  );
  const data = payload?.data as
    | { status?: string; transfer_code?: string; gateway_response?: string }
    | undefined;
  if (ok && payload?.status !== false && data?.status) {
    const s = data.status.toLowerCase();
    return {
      status: s === "success" ? "success" : s === "failed" || s === "reversed" ? "failed" : "pending",
      code: data.transfer_code,
      message: data.gateway_response,
    };
  }
  throw new Error(String(payload?.message ?? "Could not check the transfer status"));
}
