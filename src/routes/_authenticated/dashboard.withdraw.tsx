import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PaymentMethodManager } from "@/components/dashboard/PaymentMethodManager";
import { RequestHistory } from "./dashboard.deposit";
import { useWallet } from "@/lib/dashboard-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nairaFormatter } from "@/lib/market-data";
import type { PaymentMethod } from "@/lib/payment-methods";

export const Route = createFileRoute("/_authenticated/dashboard/withdraw")({
  component: WithdrawPage,
});

function WithdrawPage() {
  const queryClient = useQueryClient();
  const { data: wallet } = useWallet();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    if (n > balance) return toast.error("Amount exceeds wallet balance");
    if (!method) return toast.error("Select a payment destination");
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");

      const { error } = await supabase.from("withdrawal_requests").insert({
        user_id: uid,
        amount: n,
        currency: method.method_type === "wallet" ? method.wallet_network ?? "NGN" : "NGN",
        payment_method_id: method.id,
        note: note || null,
      });
      if (error) throw error;

      // Reserve funds immediately (demo)
      if (wallet) {
        await supabase.from("wallets")
          .update({ balance: balance - n, updated_at: new Date().toISOString() })
          .eq("id", wallet.id);
      }

      await supabase.from("notifications").insert({
        user_id: uid,
        title: "Withdrawal submitted",
        body: `Withdrawal of ${nairaFormatter.format(n)} is being processed.`,
        category: "withdrawal",
      });
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Withdrawal request submitted");
      setAmount("");
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
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
            Available: <span className="font-bold text-foreground">{nairaFormatter.format(balance)}</span>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="amt">Amount</Label>
          <Input id="amt" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>

        <PaymentMethodManager selectedId={method?.id ?? null} onSelect={setMethod} />

        <div className="space-y-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={200} />
        </div>

        <Button type="submit" variant="gold" className="w-full font-bold" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit withdrawal request
        </Button>
      </form>

      <RequestHistory rows={history} title="Withdrawal history" />
    </div>
  );
}
