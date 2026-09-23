import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
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
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const fetchKey = useServerFn(getPaystackPublicKey);
  const verify = useServerFn(verifyPaystackPayment);

  useEffect(() => {
    fetchKey()
      .then((r) => setPublicKey(r.publicKey))
      .catch(() => setPublicKey(null));
  }, [fetchKey]);

  const pay = useCallback(async () => {
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");
    if (!publicKey) return toast.error("Paystack is not configured");
    setBusy(true);
    try {
      await loadScript();
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("Sign in required");
      if (!window.PaystackPop) throw new Error("Paystack failed to load");
      const reference = `pstk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await new Promise<void>((resolve) => {
        const handler = window.PaystackPop!.setup({
          key: publicKey,
          email,
          amount: Math.round(amount * 100),
          currency: "NGN",
          ref: reference,
          callback: (r) => {
            void (async () => {
              try {
                const res = await verify({
                  data: { reference: r.reference, expectedAmount: amount },
                });
                if (res.duplicate) toast.info("Payment already credited");
                else toast.success("Deposit credited to your wallet");
                onSuccess?.();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Verification failed");
              } finally {
                resolve();
              }
            })();
          },
          onClose: () => resolve(),
        });
        handler.openIframe();
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment could not start");
    } finally {
      setBusy(false);
    }
  }, [amount, publicKey, verify, onSuccess]);

  return (
    <Button
      type="button"
      variant="gold"
      className="w-full font-bold"
      onClick={pay}
      disabled={disabled || busy || !publicKey}
    >
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
      Pay ₦{amount ? amount.toLocaleString() : "0"} with Paystack
    </Button>
  );
}
