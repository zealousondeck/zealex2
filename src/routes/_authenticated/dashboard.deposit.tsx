import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDownLeft, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PaymentMethodManager } from "@/components/dashboard/PaymentMethodManager";
import { StageTracker } from "@/components/dashboard/StageTracker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nairaFormatter } from "@/lib/market-data";
import { ReceiptActions } from "@/components/dashboard/ReceiptActions";
import type { PaymentMethod } from "@/lib/payment-methods";
import { PaystackButton } from "@/components/dashboard/PaystackButton";

export const Route = createFileRoute("/_authenticated/dashboard/deposit")({
  component: DepositPage,
});

type DepositRow = {
  id: string;
  amount: number;
  currency: string;
  reference: string;
  stage: string;
  status: string;
  note: string | null;
  created_at: string;
};

function DepositPage() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: history = [] } = useQuery({
    queryKey: ["deposits", "me"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deposit_requests")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as DepositRow[];
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0) return toast.error("Enter a valid amount");
    if (!method) return toast.error("Select a payment method");
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");

      let proofPath: string | null = null;
      if (proof) {
        const path = `${uid}/deposit-${Date.now()}-${proof.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
        const { error } = await supabase.storage.from("kyc-documents").upload(path, proof);
        if (error) throw error;
        proofPath = path;
      }

      const { error } = await supabase.from("deposit_requests").insert({
        user_id: uid,
        amount: n,
        currency: "NGN",
        payment_method_id: method.id,
        proof_path: proofPath,
        note: note || null,
      });
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: uid,
        title: "Deposit submitted",
        body: `Deposit of ${nairaFormatter.format(n)} is under review.`,
        category: "deposit",
      });
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Deposit request submitted");
      setAmount("");
      setNote("");
      setProof(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-success/10 text-success">
          <ArrowDownLeft className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Deposit</h1>
          <p className="text-sm text-muted-foreground">Fund your Zealex wallet.</p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/5 to-transparent p-5">
        <div>
          <h2 className="text-base font-bold">Instant deposit</h2>
          <p className="text-xs text-muted-foreground">Pay with card, bank transfer, or USSD via Paystack. Your wallet is credited automatically.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pstk-amt">Amount (NGN)</Label>
          <Input id="pstk-amt" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <PaystackButton
          amount={Number(amount) || 0}
          onSuccess={() => {
            setAmount("");
            queryClient.invalidateQueries({ queryKey: ["deposits"] });
            queryClient.invalidateQueries({ queryKey: ["wallet"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
          }}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="text-base font-bold">Manual bank deposit</h2>
          <p className="text-xs text-muted-foreground">Submit proof — an admin will review and credit your wallet.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amt">Amount (NGN)</Label>
          <Input id="amt" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>

        <PaymentMethodManager filterType="bank" selectedId={method?.id ?? null} onSelect={setMethod} />

        <div className="space-y-2">
          <Label>Proof of payment (optional)</Label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border p-3 hover:border-gold">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{proof ? proof.name : "Upload receipt or screenshot"}</span>
            <input type="file" accept="image/*,application/pdf" className="hidden"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={200} />
        </div>

        <Button type="submit" variant="gold" className="w-full font-bold" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit deposit request
        </Button>
      </form>

      <RequestHistory rows={history} title="Deposit history" />
    </div>
  );
}

export function RequestHistory({ rows, title }: { rows: DepositRow[]; title: string }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No requests yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{nairaFormatter.format(Number(r.amount))}</p>
                  <p className="text-xs text-muted-foreground">
                    Ref {r.reference} · {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase">
                    {r.stage.replace("_", " ")}
                  </span>
                  <ReceiptActions
                    receipt={{
                      title: `${title.replace(/ history$/i, "")} receipt`,
                      reference: r.reference,
                      status: r.status,
                      stage: r.stage,
                      createdAt: r.created_at,
                      note: r.note,
                      rows: [
                        { label: "Amount", value: nairaFormatter.format(Number(r.amount)) },
                        { label: "Currency", value: r.currency },
                      ],
                    }}
                  />
                </div>
              </div>
              <StageTracker stage={r.stage} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
