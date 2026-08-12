/** Server-only Paystack banking helpers (never imported by client code). */

export type BankOption = { name: string; code: string };

export type ResolveResult =
  | { verified: true; accountName: string; accountNumber: string }
  | { verified: false; reason: string; unavailable: boolean };

function secret() {
  // Trim: pasted keys often carry stray whitespace/newlines, which Paystack
  // rejects with a bare "Invalid key".
  const key = (process.env["PAYSTACK_SECRET_KEY"] ?? "").replace(/\s+/g, "");
  if (!key) throw new Error("Bank services are not configured on the server");
  if (!key.startsWith("sk_")) {
    // A publishable/malformed key in the secret slot is the most common cause
    // of the provider's opaque "Invalid key" response.
    throw new Error("Bank services are misconfigured on the server");
  }
  return key;
}

export async function fetchNigerianBanks(): Promise<BankOption[]> {
  let res: Response;
  try {
    res = await fetch("https://api.paystack.co/bank?currency=NGN&perPage=100", {
      headers: { Authorization: `Bearer ${secret()}` },
    });
  } catch {
    throw new Error("Could not reach the bank network — please retry");
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error("Bank services are misconfigured on the server");
  }
  if (!res.ok) throw new Error("Bank list is temporarily unavailable — please retry");
  const payload = (await res.json().catch(() => null)) as {
    status?: boolean;
    data?: { name: string; code: string }[];
  } | null;
  if (!payload?.status || !payload.data) {
    throw new Error("Bank list is temporarily unavailable — please retry");
  }
  const seen = new Set<string>();
  return payload.data
    .filter((b) => {
      if (!b.code || seen.has(b.code)) return false;
      seen.add(b.code);
      return true;
    })
    .map((b) => ({ name: b.name, code: b.code }))
    .sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Resolve a NUBAN to its registered account name.
 * Never throws for provider-side limitations: Paystack answers account
 * resolution with 401 "Invalid key" while an account is still on test keys or
 * has no Transfers access, and withdrawals must keep working in that case.
 */
export async function resolveNubanAccount(
  accountNumber: string,
  bankCode: string,
): Promise<ResolveResult> {
  let res: Response;
  try {
    res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(
        accountNumber,
      )}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: { Authorization: `Bearer ${secret()}` } },
    );
  } catch {
    return { verified: false, reason: "Could not reach the bank network", unavailable: true };
  }

  const payload = (await res.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: { account_name: string; account_number: string };
  } | null;

  if (res.ok && payload?.status && payload.data) {
    return {
      verified: true,
      accountName: payload.data.account_name,
      accountNumber: payload.data.account_number,
    };
  }

  const message = payload?.message ?? "";
  const providerBlocked =
    res.status === 401 ||
    res.status === 403 ||
    /invalid key|not allowed|permission|test mode|transfers/i.test(message);

  if (providerBlocked) {
    return {
      verified: false,
      unavailable: true,
      reason:
        "Automatic name check is unavailable on this Paystack account right now — confirm the account name yourself to continue.",
    };
  }

  return {
    verified: false,
    unavailable: false,
    reason: message || "Could not verify that account number",
  };
}
