/** Server-only Paystack banking helpers (never imported by client code). */

export type BankOption = { name: string; code: string };

function secret() {
  const key = process.env["PAYSTACK_SECRET_KEY"];
  if (!key) throw new Error("Bank verification is not configured");
  return key;
}

export async function fetchNigerianBanks(): Promise<BankOption[]> {
  const res = await fetch("https://api.paystack.co/bank?currency=NGN&perPage=100", {
    headers: { Authorization: `Bearer ${secret()}` },
  });
  if (!res.ok) throw new Error("Could not load banks right now");
  const payload = (await res.json()) as {
    status: boolean;
    data?: { name: string; code: string }[];
  };
  if (!payload.status || !payload.data) throw new Error("Could not load banks right now");
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

export async function resolveNubanAccount(accountNumber: string, bankCode: string) {
  const res = await fetch(
    `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(
      accountNumber,
    )}&bank_code=${encodeURIComponent(bankCode)}`,
    { headers: { Authorization: `Bearer ${secret()}` } },
  );
  const payload = (await res.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: { account_name: string; account_number: string };
  } | null;
  if (!res.ok || !payload?.status || !payload.data) {
    throw new Error(payload?.message || "Could not verify that account number");
  }
  return {
    accountName: payload.data.account_name,
    accountNumber: payload.data.account_number,
  };
}
