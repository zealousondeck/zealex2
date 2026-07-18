import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cryptoAssets, giftCards, nairaFormatter } from "@/lib/market-data";
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

const searchSchema = z.object({
  tab: z.enum(["buy", "sell", "giftcard"]).catch("buy"),
});

export const Route = createFileRoute("/_authenticated/dashboard/exchange")({
  validateSearch: searchSchema,
  component: ExchangePage,
});

type Mode = "buy" | "sell" | "giftcard";

const modes: { id: Mode; label: string }[] = [
  { id: "buy", label: "Buy crypto" },
  { id: "sell", label: "Sell crypto" },
  { id: "giftcard", label: "Sell gift card" },
];

function ExchangePage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(tab);
  const [asset, setAsset] = useState<string>(
    tab === "giftcard" ? giftCards[0].brand : cryptoAssets[0].symbol,
  );
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isGiftCard = mode === "giftcard";
  const options = isGiftCard
    ? giftCards.map((g) => ({ value: g.brand, label: `${g.brand} (${g.currency})` }))
    : cryptoAssets.map((c) => ({ value: c.symbol, label: `${c.name} (${c.symbol})` }));

  const rate = useMemo(() => {
    if (isGiftCard) {
      return giftCards.find((g) => g.brand === asset)?.ratePerUnit ?? 0;
    }
    return cryptoAssets.find((c) => c.symbol === asset)?.buyRate ?? 0;
  }, [asset, isGiftCard]);

  const numericAmount = Number(amount) || 0;
  // For gift cards & crypto sell, amount entered is card/crypto value → payout in NGN.
  // For crypto buy, amount entered is NGN → you receive crypto units.
  const payout = isGiftCard || mode === "sell" ? numericAmount * rate : numericAmount;
  const receivesQuantity = mode === "buy" && rate > 0 ? numericAmount / rate : null;

  function switchMode(next: Mode) {
    setMode(next);
    setAsset(next === "giftcard" ? giftCards[0].brand : cryptoAssets[0].symbol);
    navigate({ search: { tab: next }, replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (numericAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");

      const isCredit = mode === "sell" || isGiftCard;

      const { error: txError } = await supabase.from("transactions").insert({
        user_id: uid,
        type: isGiftCard ? "sell" : mode,
        category: isGiftCard ? "giftcard" : "crypto",
        asset,
        amount: Math.round(payout),
        quantity: receivesQuantity,
        status: "pending",
      });
      if (txError) throw txError;

      // Reflect credit trades in the wallet balance immediately (demo settlement).
      if (isCredit) {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("id, balance")
          .eq("user_id", uid)
          .eq("currency", "NGN")
          .maybeSingle();

        if (wallet) {
          await supabase
            .from("wallets")
            .update({
              balance: Number(wallet.balance) + Math.round(payout),
              updated_at: new Date().toISOString(),
            })
            .eq("id", wallet.id);
        }
      }

      await supabase.from("notifications").insert({
        user_id: uid,
        title: `Exchange submitted`,
        body: `Your ${isGiftCard ? "gift card" : mode} order for ${asset} is now being processed.`,
        category: "transaction",
      });

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Exchange submitted — we'll process it shortly");
      setAmount("");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exchange</h1>
        <p className="text-sm text-muted-foreground">
          Trade crypto and gift cards at premium rates.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-1.5">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => switchMode(m.id)}
            className={cn(
              "rounded-xl px-2 py-2.5 text-xs font-bold transition-colors sm:text-sm",
              mode === m.id
                ? "bg-gold text-gold-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-border bg-card p-5"
      >
        <div className="space-y-2">
          <Label>{isGiftCard ? "Gift card" : "Asset"}</Label>
          <Select value={asset} onValueChange={setAsset}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">
            {mode === "buy"
              ? "Amount to spend (NGN)"
              : isGiftCard
                ? "Card value"
                : `Amount of ${asset}`}
          </Label>
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="rounded-xl bg-secondary p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Rate</span>
            <span className="font-semibold">
              {nairaFormatter.format(rate)} {isGiftCard ? "/ unit" : `/ ${asset}`}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {mode === "buy" ? "You receive" : "You get paid"}
            </span>
            <span className="text-lg font-bold text-gold">
              {mode === "buy" && receivesQuantity !== null
                ? `${receivesQuantity.toFixed(6)} ${asset}`
                : nairaFormatter.format(payout)}
            </span>
          </div>
        </div>

        <Button
          type="submit"
          variant="gold"
          className="w-full font-bold"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
            </>
          ) : (
            <>
              <ArrowLeftRight className="mr-2 h-4 w-4" /> Submit exchange
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
