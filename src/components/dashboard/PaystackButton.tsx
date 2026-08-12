import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getPaystackPublicKey, verifyPaystackPayment } from "@/lib/paystack.functions";

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
 * Pending references survive reloads so a refresh mid-payment resumes
 * verification instead of losing the deposit. The server RPC keys on the
 * Paystack reference, so replaying verification can never credit twice.
 */
const PENDING_KEY = "zealex.paystack.pending";

type PendingPayment = { reference: string; amount: number };

function readPending(): PendingPayment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPayment;
    return parsed?.reference ? parsed : null;
  } catch {
    return null;
  }
}

function writePending(value: PendingPayment | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(PENDING_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable — verification still works in-session */
  }
}

export function PaystackButton({
  amount,
  onSuccess,
  disabled,
}: {
  amount: number;
  onSuccess?: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "checkout" | "verifying" | "done">("idle");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState(false);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const mounted = useRef(true);
  const verifying = useRef(false);
  const fetchKey = useServerFn(getPaystackPublicKey);
  const verify = useServerFn(verifyPaystackPayment);

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

  /** Verify with retries — Paystack settles a moment after the popup closes. */
  const runVerification = useCallback(
    async (reference: string, expected: number) => {
      // Guard against overlapping verifications (double clicks, retries,
      // resume-on-mount racing the callback).
      if (verifying.current) return false;
      verifying.current = true;
      const record = { reference, amount: expected };
      setPending(record);
      writePending(record);
      setPhase("verifying");
      let lastError = "Verification failed";
      // Non-retryable outcomes must stop the loop and clear the pending payment.
      const isFinal = (m: string) =>
        /not completed|declined|misconfigured|Only Naira|zero payment/i.test(m);
      const MAX = 6;
      try {
        for (let attempt = 0; attempt < MAX; attempt++) {
          try {
            const res = await verify({ data: { reference, expectedAmount: expected } });
            writePending(null);
            if (!mounted.current) return true;
            setPending(null);
            setPhase("done");
            if (res.duplicate) toast.info("This payment was already credited");
            else toast.success("Deposit credited to your wallet");
            onSuccess?.();
            setTimeout(() => mounted.current && setPhase("idle"), 2500);
            return true;
          } catch (err) {
            lastError = err instanceof Error ? err.message : lastError;
            if (isFinal(lastError)) {
              writePending(null);
              if (!mounted.current) return false;
              setPending(null);
              setPhase("idle");
              toast.error(lastError);
              return false;
            }
            if (attempt < MAX - 1) await sleep(1500 * (attempt + 1));
          }
        }
        if (!mounted.current) return false;
        setPhase("idle");
        toast.error(`${lastError}. You can retry the verification below.`);
        // Surface whatever already landed in history/wallet meanwhile.
        onSuccess?.();
        return false;

      } finally {
        verifying.current = false;
      }
    },
    [verify, onSuccess],
  );

  // Resume an interrupted verification after a reload.
  useEffect(() => {
    const stored = readPending();
    if (!stored) return;
    setPending(stored);
    void runVerification(stored.reference, stored.amount);
  }, [runVerification]);

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
      // Paystack's callback runs inside its iframe context — capture the
      // reference synchronously and do all async work after the popup closes.
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
      // Persist before verifying so a refresh mid-verification resumes.
      writePending({ reference: outcome.reference, amount: amountAtCheckout });
      await runVerification(outcome.reference, amountAtCheckout);
    } catch (err) {
      setPhase("idle");
      toast.error(err instanceof Error ? err.message : "Payment could not start");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [amount, publicKey, runVerification]);

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
    <div className="space-y-2">
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

      {pending && phase !== "verifying" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => runVerification(pending.reference, pending.amount)}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Retry verification
        </Button>
      )}
    </div>
  );
}
