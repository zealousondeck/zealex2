import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDownLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StageTracker } from "@/components/dashboard/StageTracker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nairaFormatter } from "@/lib/market-data";
import { ReceiptActions } from "@/components/dashboard/ReceiptActions";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-success/10 text-success">
          <ArrowDownLeft className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Deposit</h1>
          <p className="text-sm text-muted-foreground">Fund your Zealex wallet instantly.</p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/5 to-transparent p-5">
        <div>
          <h2 className="text-base font-bold">Instant deposit</h2>
          <p className="text-xs text-muted-foreground">
            Pay with card, bank transfer, or USSD. Your wallet is credited automatically once the
            payment succeeds.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pstk-amt">Amount (NGN)</Label>
          <Input
            id="pstk-amt"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
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

      <RequestHistory rows={history} title="Deposit history" />
    </div>
  );
}


const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-secondary text-muted-foreground" },
  processing: { label: "Processing", className: "bg-gold-soft text-foreground" },
  approved: { label: "Processing", className: "bg-gold-soft text-foreground" },
  completed: { label: "Completed", className: "bg-success/10 text-success" },
  paid: { label: "Completed", className: "bg-success/10 text-success" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  rejected: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Failed", className: "bg-destructive/10 text-destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_STYLES[(status ?? "").toLowerCase()] ?? {
    label: status || "Pending",
    className: "bg-secondary text-muted-foreground",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${meta.className}`}
    >
      {meta.label}
    </span>
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
                  <StatusBadge status={r.status} />
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
