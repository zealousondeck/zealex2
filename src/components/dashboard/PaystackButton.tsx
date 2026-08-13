import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getPaystackPublicKey, verifyPaystackPayment } from "@/lib/paystack.functions";
import { clearAttempt, recordAttempt, updateAttempt } from "@/lib/deposit-attempts";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref?: string;
        callback: (r: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

const SCRIPT_SRC = "https://js.paystack.co/v1/inline.js";

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Not in browser"));
    if (window.PaystackPop) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Paystack")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Paystack"));
    document.body.appendChild(s);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Explicitly verify one reference. Idempotent: the server keys on the Paystack
 * reference so a replay can never credit the wallet twice.
 */
export function useVerifyDeposit() {
  const verify = useServerFn(verifyPaystackPayment);
  return useCallback(
    async (reference: string, expected: number, opts?: { retries?: number }) => {
      const MAX = opts?.retries ?? 1;
      let lastError = "Verification failed";
      const isFinal = (m: string) =>
        /not completed|declined|misconfigured|Only Naira|zero payment/i.test(m);
      for (let attempt = 0; attempt < MAX; attempt++) {
        try {
          const res = await verify({ data: { reference, expectedAmount: expected } });
          clearAttempt(reference);
          return { ok: true as const, duplicate: Boolean(res.duplicate) };
        } catch (err) {
          lastError = err instanceof Error ? err.message : lastError;
          if (isFinal(lastError)) {
            updateAttempt(reference, { status: "failed", reason: lastError });
            return { ok: false as const, message: lastError, final: true };
          }
          if (attempt < MAX - 1) await sleep(1500 * (attempt + 1));
        }
      }
      updateAttempt(reference, { status: "pending", reason: lastError });
      return { ok: false as const, message: lastError, final: false };
    },
    [verify],
  );
}

export function PaystackButton({
  amount,
  onSuccess,
  onSettled,
  disabled,
}: {
  amount: number;
  onSuccess?: () => void;
  onSettled?: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "checkout" | "verifying" | "done">("idle");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState(false);
  const mounted = useRef(true);
  const fetchKey = useServerFn(getPaystackPublicKey);
  const verifyDeposit = useVerifyDeposit();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadKey = useCallback(() => {
    setKeyError(false);
    fetchKey()
      .then((r) => setPublicKey(r.publicKey))
      .catch(() => {
        setPublicKey(null);
        setKeyError(true);
      });
  }, [fetchKey]);

  useEffect(() => {
    loadKey();
  }, [loadKey]);

  const pay = useCallback(async () => {
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");
    if (!publicKey) return toast.error("Payments are not available right now");
    setBusy(true);
    setPhase("checkout");
    try {
      await loadScript();
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("Please sign in again to continue");
      if (!window.PaystackPop) throw new Error("Paystack could not be loaded");

      const reference = `pstk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const amountAtCheckout = amount;

      const outcome = await new Promise<{ reference: string } | null>((resolve) => {
        let settled = false;
        const handler = window.PaystackPop!.setup({
          key: publicKey,
          email,
          amount: Math.round(amount * 100),
          currency: "NGN",
          ref: reference,
          callback: (r) => {
            settled = true;
            resolve({ reference: r.reference || reference });
          },
          onClose: () => {
            if (!settled) resolve(null);
          },
        });
        handler.openIframe();
      });

      if (!outcome) {
        setPhase("idle");
        toast.info("Payment cancelled");
        return;
      }

      // Only now — after a completed checkout — does verification begin.
      recordAttempt({
        reference: outcome.reference,
        amount: amountAtCheckout,
        createdAt: new Date().toISOString(),
        status: "pending",
      });
      onSettled?.();
      setPhase("verifying");
      const result = await verifyDeposit(outcome.reference, amountAtCheckout, { retries: 4 });
      if (!mounted.current) return;
      if (result.ok) {
        setPhase("done");
        if (result.duplicate) toast.info("This payment was already credited");
        else toast.success("Deposit credited to your wallet");
        onSuccess?.();
        setTimeout(() => mounted.current && setPhase("idle"), 2500);
      } else {
        setPhase("idle");
        toast.error(`${result.message}. You can check the payment status below.`);
        onSettled?.();
      }
    } catch (err) {
      setPhase("idle");
      toast.error(err instanceof Error ? err.message : "Payment could not start");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [amount, publicKey, verifyDeposit, onSuccess, onSettled]);

  if (keyError) {
    return (
      <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <p className="text-muted-foreground">Instant payments are temporarily unavailable.</p>
        <Button type="button" variant="outline" size="sm" onClick={loadKey}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="gold"
      className="w-full font-bold"
      onClick={pay}
      disabled={disabled || busy || !publicKey || phase === "verifying"}
    >
      {phase === "done" ? (
        <CheckCircle2 className="mr-2 h-4 w-4 animate-in zoom-in duration-300" />
      ) : busy || phase === "verifying" ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 h-4 w-4" />
      )}

      {phase === "verifying"
        ? "Confirming payment…"
        : phase === "done"
          ? "Wallet credited"
          : `Pay ₦${amount ? amount.toLocaleString() : "0"} with Paystack`}
    </Button>
  );
}
