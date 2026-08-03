import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { RequestHistory } from "./dashboard.deposit";
import { useWallet } from "@/lib/dashboard-data";
import { usePaymentMethods } from "@/lib/payment-methods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { nairaFormatter } from "@/lib/market-data";
import { listNigerianBanks, resolveBankAccount, submitWithdrawal } from "@/lib/withdrawals.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/withdraw")({
  component: WithdrawPage,
});

function WithdrawPage() {
  const queryClient = useQueryClient();
  const { data: wallet } = useWallet();
  const { data: savedMethods = [] } = usePaymentMethods();

  const banksFn = useServerFn(listNigerianBanks);
  const resolveFn = useServerFn(resolveBankAccount);
  const submitFn = useServerFn(submitWithdrawal);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [saveMethod, setSaveMethod] = useState(true);
  const [done, setDone] = useState(false);

  const banksQuery = useQuery({
    queryKey: ["ng-banks"],
    queryFn: () => banksFn(),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
  const banks = banksQuery.data?.banks ?? [];
  const bankName = banks.find((b) => b.code === bankCode)?.name ?? "";

  const { data: history = [] } = useQuery({
    queryKey: ["withdrawals", "me"],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const balance = Number(wallet?.balance ?? 0);
  const amountNumber = Number(amount) || 0;

  const resolveMut = useMutation({
    mutationFn: () => resolveFn({ data: { accountNumber, bankCode } }),
    onSuccess: (r) => {
      setAccountName(r.accountName);
      setResolveError(null);
    },
    onError: (e) => {
      setAccountName(null);
      setResolveError(e instanceof Error ? e.message : "Could not verify that account");
    },
  });

  // Auto-resolve once a bank is chosen and 10 digits are entered.
  useEffect(() => {
    setAccountName(null);
    setResolveError(null);
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) return;
    const t = setTimeout(() => resolveMut.mutate(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankCode, accountNumber]);

  const submitMut = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          amount: amountNumber,
          bankCode,
          bankName,
          accountNumber,
          note: note || undefined,
          saveMethod,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Withdrawal of ${nairaFormatter.format(amountNumber)} submitted`);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      setAmount("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      void r;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit withdrawal"),
  });

  const overBalance = amountNumber > balance;
  const canSubmit =
    amountNumber > 0 && !overBalance && !!bankCode && !!accountName && !submitMut.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountNumber) return toast.error("Enter a valid amount");
    if (overBalance) return toast.error("Amount exceeds your wallet balance");
    if (!bankCode) return toast.error("Select your bank");
    if (!accountName) return toast.error("Verify your account number first");
    submitMut.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-soft text-foreground">
          <ArrowUpRight className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Withdraw</h1>
          <p className="text-sm text-muted-foreground">
            Available:{" "}
            <span className="font-bold text-foreground">{nairaFormatter.format(balance)}</span>
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="space-y-2">
          <Label htmlFor="amt">Amount (NGN)</Label>
          <Input
            id="amt"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={cn(overBalance && "border-destructive focus-visible:ring-destructive")}
          />
          <div className="flex items-center justify-between text-xs">
            <span className={overBalance ? "text-destructive" : "text-muted-foreground"}>
              {overBalance ? "Amount exceeds your wallet balance" : "Minimum ₦1"}
            </span>
            <button
              type="button"
              className="font-semibold text-gold hover:underline"
              onClick={() => setAmount(String(balance))}
            >
              Use max
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Bank</Label>
            {banksQuery.isLoading ? (
              <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading banks…
              </div>
            ) : banksQuery.isError ? (
              <div className="flex items-center gap-2">
                <p className="text-sm text-destructive">Banks unavailable.</p>
                <Button type="button" size="sm" variant="outline" onClick={() => banksQuery.refetch()}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            ) : (
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your bank" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {banks.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="acct">Account number</Label>
            <Input
              id="acct"
              inputMode="numeric"
              maxLength={10}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="0123456789"
              className={cn(resolveError && "border-destructive focus-visible:ring-destructive")}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-3 text-sm">
          {resolveMut.isPending ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying account…
            </span>
          ) : accountName ? (
            <span className="flex items-center gap-2 font-semibold text-success">
              <ShieldCheck className="h-4 w-4" /> {accountName}
            </span>
          ) : resolveError ? (
            <span className="flex items-center justify-between gap-2">
              <span className="text-destructive">{resolveError}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => resolveMut.mutate()}
                disabled={!bankCode || !/^\d{10}$/.test(accountNumber)}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
              </Button>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Select a bank and enter your 10-digit account number to verify the account name.
            </span>
          )}
        </div>

        {savedMethods.filter((m) => m.method_type === "bank").length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Saved accounts
            </Label>
            <div className="flex flex-wrap gap-2">
              {savedMethods
                .filter((m) => m.method_type === "bank" && m.account_number)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      const match = banks.find(
                        (b) => b.name.toLowerCase() === (m.bank_name ?? "").toLowerCase(),
                      );
                      if (match) setBankCode(match.code);
                      setAccountNumber((m.account_number ?? "").replace(/\D/g, "").slice(0, 10));
                    }}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:border-gold hover:bg-gold-soft"
                  >
                    {m.bank_name} · {(m.account_number ?? "").slice(-4)}
                  </button>
                ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={saveMethod}
            onChange={(e) => setSaveMethod(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--gold,45_90%_50%))]"
          />
          Save this account for faster withdrawals
        </label>

        <div className="space-y-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={200}
          />
        </div>

        <Button type="submit" variant="gold" className="w-full font-bold" disabled={!canSubmit}>
          {submitMut.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : done ? (
            <CheckCircle2 className="mr-2 h-4 w-4 animate-in zoom-in duration-300" />
          ) : null}
          {submitMut.isPending
            ? "Submitting…"
            : done
              ? "Request submitted"
              : "Submit withdrawal request"}
        </Button>
      </form>

      <RequestHistory rows={history} title="Withdrawal history" />
    </div>
  );
}
