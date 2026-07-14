import { useState } from "react";
import { Plus, Trash2, Banknote, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import {
  usePaymentMethods,
  useAddPaymentMethod,
  useDeletePaymentMethod,
  type PaymentMethod,
} from "@/lib/payment-methods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function PaymentMethodManager({
  onSelect,
  selectedId,
  filterType,
}: {
  onSelect?: (m: PaymentMethod) => void;
  selectedId?: string | null;
  filterType?: "bank" | "wallet";
}) {
  const { data: methods = [], isLoading } = usePaymentMethods();
  const del = useDeletePaymentMethod();
  const [open, setOpen] = useState(false);
  const filtered = filterType ? methods.filter((m) => m.method_type === filterType) : methods;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Saved {filterType === "bank" ? "banks" : filterType === "wallet" ? "wallets" : "methods"}
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      {open && <AddForm defaultType={filterType ?? "bank"} onClose={() => setOpen(false)} />}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          No saved {filterType ?? "methods"} yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => {
            const isSelected = selectedId === m.id;
            const Icon = m.method_type === "wallet" ? WalletIcon : Banknote;
            return (
              <li
                key={m.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                  isSelected ? "border-gold bg-gold-soft" : "border-border bg-background",
                  onSelect && "cursor-pointer hover:border-gold",
                )}
                onClick={() => onSelect?.(m)}
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-secondary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.method_type === "bank"
                      ? `${m.bank_name} · ${m.account_number}`
                      : `${m.wallet_network} · ${m.wallet_address}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Remove this method?")) del.mutate(m.id);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete method"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddForm({ defaultType, onClose }: { defaultType: "bank" | "wallet"; onClose: () => void }) {
  const add = useAddPaymentMethod();
  const [type, setType] = useState<"bank" | "wallet">(defaultType);
  const [label, setLabel] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletNetwork, setWalletNetwork] = useState("BTC");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label) return toast.error("Label required");
    try {
      await add.mutateAsync({
        method_type: type,
        label,
        bank_name: type === "bank" ? bankName : null,
        account_number: type === "bank" ? accountNumber : null,
        account_name: type === "bank" ? accountName : null,
        wallet_address: type === "wallet" ? walletAddress : null,
        wallet_network: type === "wallet" ? walletNetwork : null,
      });
      toast.success("Saved");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as "bank" | "wallet")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bank">Bank account</SelectItem>
              <SelectItem value="wallet">Crypto wallet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. GTB main" maxLength={40} />
        </div>
      </div>

      {type === "bank" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Bank</Label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label>Account number</Label>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} maxLength={20} />
          </div>
          <div className="space-y-1.5">
            <Label>Account name</Label>
            <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} maxLength={80} />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Network</Label>
            <Select value={walletNetwork} onValueChange={setWalletNetwork}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BTC">Bitcoin</SelectItem>
                <SelectItem value="ETH">Ethereum (ERC20)</SelectItem>
                <SelectItem value="USDT-TRC20">USDT (TRC20)</SelectItem>
                <SelectItem value="USDT-ERC20">USDT (ERC20)</SelectItem>
                <SelectItem value="SOL">Solana</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} maxLength={120} />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="gold" size="sm" disabled={add.isPending}>Save</Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
