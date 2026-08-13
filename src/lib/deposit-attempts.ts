import { useCallback, useEffect, useState } from "react";

/**
 * Local record of Paystack checkout attempts that have not been confirmed yet.
 * Only non-sensitive data (reference + amount) is stored so the user can come
 * back later and deliberately re-check a payment. Nothing here is ever
 * auto-verified — verification is always an explicit user action.
 */
export type DepositAttempt = {
  reference: string;
  amount: number;
  createdAt: string;
  status: "pending" | "failed";
  reason?: string;
};

const KEY = "zealex.deposit.attempts";
const EVENT = "zealex:deposit-attempts";

function read(): DepositAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DepositAttempt[];
    return Array.isArray(parsed) ? parsed.filter((a) => a?.reference) : [];
  } catch {
    return [];
  }
}

function write(list: DepositAttempt[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* storage unavailable — attempts simply aren't remembered */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function recordAttempt(attempt: DepositAttempt) {
  const list = read().filter((a) => a.reference !== attempt.reference);
  write([attempt, ...list]);
}

export function updateAttempt(reference: string, patch: Partial<DepositAttempt>) {
  write(read().map((a) => (a.reference === reference ? { ...a, ...patch } : a)));
}

export function clearAttempt(reference: string) {
  write(read().filter((a) => a.reference !== reference));
}

/** Reactive view of the stored attempts. */
export function useDepositAttempts() {
  const [attempts, setAttempts] = useState<DepositAttempt[]>([]);

  const sync = useCallback(() => setAttempts(read()), []);

  useEffect(() => {
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);

  return attempts;
}
