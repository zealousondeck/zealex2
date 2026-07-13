import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const searchSchema = z.object({
  email: z.string().catch(""),
});

export const Route = createFileRoute("/auth/verify")({
  ssr: false,
  validateSearch: searchSchema,
  component: VerifyPage,
});

function VerifyPage() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify(value: string) {
    if (value.length !== 6 || !email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: value,
        type: "signup",
      });
      if (error) throw error;
      toast.success("Email verified — welcome to ZEAlex!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code");
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
      toast.success("A new code is on its way");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-card sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-soft text-foreground">
            <MailCheck className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold">Verify your email</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the 6-digit code we sent to{" "}
            <span className="font-semibold text-foreground">
              {email || "your email"}
            </span>
            .
          </p>

          <div className="mt-6 flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (v.length === 6) handleVerify(v);
              }}
              disabled={loading}
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            variant="gold"
            className="mt-6 w-full font-bold"
            onClick={() => handleVerify(code)}
            disabled={loading || code.length !== 6}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify
          </Button>

          <p className="mt-4 text-sm text-muted-foreground">
            Didn't get it?{" "}
            <button
              onClick={handleResend}
              disabled={resending}
              className="font-semibold text-gold hover:underline disabled:opacity-60"
            >
              Resend code
            </button>
          </p>
          <Link
            to="/auth"
            className="mt-2 inline-block text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
