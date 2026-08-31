import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  CreditCard,
  Gift,
  Loader2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { giftCards, nairaFormatter } from "@/lib/market-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "./dashboard.deposit";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tab: z.enum(["sell", "buy"]).catch("sell"),
});

export const Route = createFileRoute("/_authenticated/dashboard/exchange")({
  validateSearch: searchSchema,
  component: ExchangePage,
});

type TradeMode = "sell" | "buy";

type RecentGiftCardTrade = {
  id: string;
  asset: string | null;
  amount: number;
  type: string;
  status: string;
  created_at: string;
};

const tradeModes: { id: TradeMode; label: string }[] = [
  { id: "sell", label: "Sell Gift Card" },
  { id: "buy", label: "Buy Gift Card" },
];

function ExchangePage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<TradeMode>(tab);
  const [brand, setBrand] = useState(giftCards[0].brand);
  const [amount, setAmount] = useState("100");
  const [cardType, setCardType] = useState("Physical");
  const [submitState, setSubmitState] = useState<"idle" | "loading">("idle");

  const selectedCard = useMemo(
    () => giftCards.find((card) => card.brand === brand) ?? giftCards[0],
    [brand],
  );

  const numericAmount = Number(amount) || 0;
  const rate = selectedCard.ratePerUnit;
  const estimatedValue = numericAmount * rate;

  function switchMode(next: TradeMode) {
    setMode(next);
    setBrand(giftCards[0].brand);
    navigate({ search: { tab: next }, replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (numericAmount <= 0) {
      toast.error("Enter a valid gift card value");
      return;
    }

    setSubmitState("loading");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");

      const { error: txError } = await supabase.from("transactions").insert({
        user_id: uid,
        type: mode,
        category: "giftcard",
        asset: brand,
        amount: Math.round(estimatedValue),
        quantity: Number(amount),
        status: "pending",
        stage: "submitted",
      });

      if (txError) throw txError;

      await supabase.from("notifications").insert({
        user_id: uid,
        title: "Gift card trade submitted",
        body: `Your ${mode === "sell" ? "sell" : "buy"} request for ${brand} is being processed.`,
        category: "transaction",
      });

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Gift card trade submitted");
      setAmount("100");
      navigate({ to: "/dashboard/exchange-history", replace: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitState("idle");
    }
  }

  const stats = [
    { label: "Live rate", value: `${nairaFormatter.format(rate)}/unit`, icon: TrendingUp },
    { label: "Secure trading", value: "Verified", icon: ShieldCheck },
    { label: "Fast settlements", value: "5–15 min", icon: Clock3 },
  ];

  return (
    <div className="space-y-6 pb-10">
      <header className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold-soft/60 px-3 py-1 text-xs font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Secure trading
            </div>
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Gift Card Exchange
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Sell your gift cards securely and get paid fast.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                "Verified rates",
                "Fast settlements",
                "Trusted payouts",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-border bg-secondary/60 p-3">
                <Icon className="h-4 w-4 text-gold" />
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_340px]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-border bg-card shadow-soft">
            <CardHeader className="border-b border-border bg-secondary/50 p-4 md:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">Trade workspace</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Choose a gift card action and review your rate before submitting.
                  </CardDescription>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <BadgeCheck className="h-3.5 w-3.5 text-success" />
                  Live rates
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 md:p-5">
              <Tabs
                value={mode}
                onValueChange={(value) => switchMode(value as TradeMode)}
                className="space-y-5"
              >
                <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-secondary p-1">
                  {tradeModes.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="rounded-xl py-2.5 text-sm font-semibold"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="sell" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sell-brand">Gift card brand</Label>
                    <Select value={brand} onValueChange={setBrand}>
                      <SelectTrigger id="sell-brand" className="h-12 rounded-xl">
                        <SelectValue placeholder="Select a gift card" />
                      </SelectTrigger>
                      <SelectContent>
                        {giftCards.map((card) => (
                          <SelectItem key={card.brand} value={card.brand}>
                            {card.brand} · {card.currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sell-value">Card value</Label>
                      <Input
                        id="sell-value"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="100"
                        className="h-12 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sell-currency">Currency</Label>
                      <Select value={selectedCard.currency} defaultValue={selectedCard.currency}>
                        <SelectTrigger id="sell-currency" className="h-12 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={selectedCard.currency}>{selectedCard.currency}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sell-card-type">Card format</Label>
                      <Select value={cardType} onValueChange={setCardType}>
                        <SelectTrigger id="sell-card-type" className="h-12 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Physical">Physical</SelectItem>
                          <SelectItem value="E-code">E-code</SelectItem>
                          <SelectItem value="Mobile wallet">Mobile wallet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sell-upload">Card details</Label>
                      <div className="flex h-12 items-center justify-between rounded-xl border border-dashed border-border bg-secondary/40 px-3 text-sm text-muted-foreground">
                        <span className="truncate">Upload reference photo</span>
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="buy" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="buy-brand">Select gift card brand</Label>
                    <Select value={brand} onValueChange={setBrand}>
                      <SelectTrigger id="buy-brand" className="h-12 rounded-xl">
                        <SelectValue placeholder="Choose a card" />
                      </SelectTrigger>
                      <SelectContent>
                        {giftCards.map((card) => (
                          <SelectItem key={card.brand} value={card.brand}>
                            {card.brand} · {card.currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="buy-value">Denomination</Label>
                      <Input
                        id="buy-value"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="100"
                        className="h-12 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="buy-currency">Currency</Label>
                      <Select value={selectedCard.currency} defaultValue={selectedCard.currency}>
                        <SelectTrigger id="buy-currency" className="h-12 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={selectedCard.currency}>{selectedCard.currency}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Availability</span>
                      <span>Updated live</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{selectedCard.brand}</p>
                        <p className="text-xs text-muted-foreground">{selectedCard.category}</p>
                      </div>
                      <span className="rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-foreground">
                        {selectedCard.change24h >= 0 ? "+" : ""}
                        {selectedCard.change24h}%
                      </span>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">Rate summary</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {mode === "sell" ? "Payout preview" : "Estimated spend"}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Gift card value</span>
                    <span className="font-semibold text-foreground">
                      {numericAmount > 0 ? `${nairaFormatter.format(Math.round(numericAmount))}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="font-semibold text-foreground">
                      {nairaFormatter.format(rate)} / unit
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="text-muted-foreground">
                      {mode === "sell" ? "Estimated payout" : "Estimated total"}
                    </span>
                    <span className="text-lg font-extrabold text-gold">
                      {numericAmount > 0 ? nairaFormatter.format(Math.round(estimatedValue)) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="gold"
                size="lg"
                className="mt-5 w-full justify-center font-semibold"
                onClick={handleSubmit}
                disabled={submitState === "loading" || numericAmount <= 0}
              >
                {submitState === "loading" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting trade...
                  </>
                ) : (
                  <>
                    {mode === "sell" ? "Sell Gift Card" : "Buy Gift Card"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <PopularGiftCards />
        </div>

        <aside className="space-y-6">
          <Card className="border-border bg-card shadow-soft">
            <CardHeader className="p-4 md:p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gold-soft text-foreground">
                  <CreditCard className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle className="text-lg font-bold">Quick estimate</CardTitle>
                  <CardDescription className="text-xs">Live gift card rate</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 md:p-5 md:pt-0">
              <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Selected card
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-foreground">{selectedCard.brand}</p>
                    <p className="text-xs text-muted-foreground">{selectedCard.category}</p>
                  </div>
                  <span className="rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-foreground">
                    {selectedCard.currency}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Card value</span>
                  <span className="font-semibold text-foreground">
                    {numericAmount > 0 ? `${nairaFormatter.format(Math.round(numericAmount))}` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current rate</span>
                  <span className="font-semibold text-foreground">
                    {nairaFormatter.format(rate)} / unit
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">
                    {mode === "sell" ? "Payout" : "Estimated amount"}
                  </span>
                  <span className="text-base font-extrabold text-gold">
                    {numericAmount > 0 ? nairaFormatter.format(Math.round(estimatedValue)) : "—"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-soft">
            <CardHeader className="p-4 md:p-5">
              <CardTitle className="text-lg font-bold">How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 md:p-5 md:pt-0">
              {[
                "Choose your gift card",
                "Enter the card details",
                "Review your rate",
                "Submit your trade",
                "Receive your payout",
              ].map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-soft text-xs font-bold text-foreground">
                    {index + 1}
                  </span>
                  <p className="text-sm text-foreground">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>

      <PopularGiftCards />

      <RecentGiftCardActivity />
    </div>
  );
}

function PopularGiftCards() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Popular gift cards
          </p>
          <h2 className="mt-1 text-2xl font-bold">Trending brands</h2>
        </div>
        <span className="hidden rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground sm:inline-flex">
          {giftCards.length}+ brands
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {giftCards.slice(0, 4).map((card) => (
          <Card key={card.brand} className="border-border bg-card shadow-soft transition-colors hover:border-gold/40">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-soft text-gold-foreground">
                    <Gift className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-bold text-foreground">{card.brand}</p>
                    <p className="text-[11px] text-muted-foreground">{card.category}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-success">
                  {card.change24h >= 0 ? "+" : ""}
                  {card.change24h}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{card.currency}</span>
                <span>Live</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <p className="text-sm text-foreground">
                  <span className="font-bold">{nairaFormatter.format(card.ratePerUnit)}</span>
                  <span className="text-muted-foreground"> / unit</span>
                </p>
                <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs font-semibold">
                  Trade
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function RecentGiftCardActivity() {
  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["transactions", "giftcard-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, asset, amount, type, status, created_at")
        .eq("category", "giftcard")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data ?? []) as RecentGiftCardTrade[];
    },
  });

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Recent gift card activity
        </p>
        <h2 className="mt-1 text-2xl font-bold">Your recent trades</h2>
      </div>

      {isLoading ? (
        <Card className="border-border bg-card p-6 text-sm text-muted-foreground shadow-soft">
          Loading recent trades...
        </Card>
      ) : isError ? (
        <Card className="border-border bg-card p-6 text-sm text-destructive shadow-soft">
          Unable to load recent activity right now.
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-border bg-card p-6 text-sm text-muted-foreground shadow-soft">
          No gift card trades yet. Your completed trades will appear here.
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id} className="border-border bg-card shadow-soft">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-foreground">{row.asset ?? "Gift card"}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.type === "sell" ? "Sell" : "Buy"} · {new Date(row.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gold">{nairaFormatter.format(Number(row.amount))}</span>
                  <StatusBadge status={row.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
