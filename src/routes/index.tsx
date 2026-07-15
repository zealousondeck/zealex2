import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Gift,
  Headphones,
  Landmark,
  LineChart,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  Wallet,
} from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { RateTicker } from "@/components/site/RateTicker";
import { RateCalculator } from "@/components/site/RateCalculator";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  cryptoAssets,
  faqs,
  giftCards,
  nairaFormatter,
  testimonials,
} from "@/lib/market-data";
import { cn } from "@/lib/utils";
import heroImg from "@/assets/hero-dashboard.jpg";
import phoneImg from "@/assets/app-phone.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </section>
  );
}

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <Section className="relative pt-14 pb-10 lg:pt-20">
        <div className="pointer-events-none absolute -top-24 right-0 -z-10 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div {...fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold-soft/50 px-3.5 py-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Trusted by 120,000+ traders across Africa
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Trade gift cards & crypto at the{" "}
              <span className="text-gradient-gold">best rates</span>, instantly.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Zealex Exchange turns your gift cards and cryptocurrency into cash in minutes.
              Premium rates, bank-grade security, and payouts that actually land instantly.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button variant="gold" size="xl" className="font-semibold">
                Start trading free <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="goldOutline" size="xl" className="font-semibold" asChild>
                <a href="#rates">View live rates</a>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              {[
                { k: "₦48B+", v: "Traded volume" },
                { k: "< 5 min", v: "Avg. payout" },
                { k: "4.9/5", v: "User rating" },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="font-display text-2xl font-extrabold">{s.k}</dt>
                  <dd className="text-xs text-muted-foreground">{s.v}</dd>
                </div>
              ))}
            </dl>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-gold opacity-15 blur-2xl" />
            <img
              src={heroImg}
              alt="Zealex Exchange dashboard showing wallet balance and live exchange rates"
              width={1600}
              height={1200}
              className="w-full rounded-3xl border border-border/60 shadow-card"
            />
          </motion.div>
        </div>
      </Section>

      <RateTicker />

      {/* Live rates + calculator */}
      <Section id="rates" className="py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr]">
          <motion.div {...fadeUp}>
            <h2 className="font-display text-3xl font-extrabold sm:text-4xl">Live exchange rates</h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Real market rates, refreshed continuously. No hidden spreads — the rate you see is
              the rate you get.
            </p>

            <div className="mt-8 space-y-6">
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  <LineChart className="h-4 w-4 text-gold" /> Cryptocurrency
                </h3>
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
                  {cryptoAssets.slice(0, 5).map((c, i) => (
                    <RateRow
                      key={c.symbol}
                      label={c.name}
                      sub={c.networks.join(" · ")}
                      badge={c.symbol}
                      value={`${nairaFormatter.format(c.buyRate)}`}
                      change={c.change24h}
                      last={i === 4}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  <Gift className="h-4 w-4 text-gold" /> Gift cards
                </h3>
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
                  {giftCards.slice(0, 5).map((g, i) => (
                    <RateRow
                      key={g.brand}
                      label={g.brand}
                      sub={g.category}
                      badge={g.currency}
                      value={`${nairaFormatter.format(g.ratePerUnit)}/$`}
                      change={g.change24h}
                      last={i === 4}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div {...fadeUp} className="lg:sticky lg:top-24 lg:self-start">
            <RateCalculator />
          </motion.div>
        </div>
      </Section>

      {/* Why choose us */}
      <div className="bg-secondary/50 py-16 lg:py-24">
        <Section id="features">
          <motion.div {...fadeUp} className="max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
              Why traders choose Zealex
            </h2>
            <p className="mt-3 text-muted-foreground">
              Built for people who take their money seriously. Every detail is designed for speed,
              safety, and trust.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.05 }}
                className="group rounded-2xl border border-border/60 bg-card p-6 shadow-soft transition-shadow hover:shadow-card"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold-soft text-gold-foreground transition-colors group-hover:bg-gradient-gold">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </Section>
      </div>

      {/* How it works */}
      <Section id="how" className="py-16 lg:py-24">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">How it works</h2>
          <p className="mt-3 text-muted-foreground">
            From upload to payout in four simple steps. Track every stage in real time.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.06 }}
              className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-soft"
            >
              <span className="font-display text-sm font-extrabold text-gold">
                0{i + 1}
              </span>
              <span className="mt-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-ink text-ink-foreground">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Progress tracker */}
        <motion.div
          {...fadeUp}
          className="mt-10 rounded-3xl border border-border/60 bg-gradient-ink p-6 text-ink-foreground sm:p-8"
        >
          <p className="text-sm font-semibold text-gold">Transaction progress tracker</p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            {["Submitted", "Under review", "Approved", "Paid"].map((stage, i) => (
              <div key={stage} className="flex flex-1 items-center gap-3">
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                    i <= 2 ? "bg-gradient-gold text-gold-foreground" : "bg-white/10 text-ink-foreground/50",
                  )}
                >
                  {i <= 2 ? <BadgeCheck className="h-4 w-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    i <= 2 ? "text-ink-foreground" : "text-ink-foreground/50",
                  )}
                >
                  {stage}
                </span>
                {i < 3 && (
                  <span className="hidden h-px flex-1 bg-white/10 sm:block" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* Testimonials */}
      <div className="bg-secondary/50 py-16 lg:py-24">
        <Section>
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
              Loved by traders everywhere
            </h2>
            <p className="mt-3 text-muted-foreground">
              Real feedback from people who trade with Zealex every day.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.figure
                key={t.name}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.06 }}
                className="flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-soft"
              >
                <div className="flex gap-0.5 text-gold">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-ink text-xs font-bold text-ink-foreground">
                      {t.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </Section>
      </div>

      {/* Download app */}
      <Section className="py-16 lg:py-24">
        <div className="grid items-center gap-10 rounded-[2rem] border border-border/60 bg-gradient-ink p-8 text-ink-foreground shadow-card sm:p-12 lg:grid-cols-2">
          <motion.div {...fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold">
              <Smartphone className="h-3.5 w-3.5 text-gold" /> Zealex mobile
            </span>
            <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">
              Your exchange, in your pocket
            </h2>
            <p className="mt-3 max-w-md text-ink-foreground/70">
              Trade, track payouts, and manage your wallet on the go. Real-time notifications keep
              you updated on every rate change and transaction.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button variant="gold" size="lg">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                  <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.9-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.15-.47 7.8 1.3 10.35.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.27 3.15-2.53.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.72-1.04-2.75-4.13zM14.5 4.6c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.09 3.18 1.15.09 2.32-.58 3.04-1.45z" />
                </svg>
                App Store
              </Button>
              <Button variant="goldOutline" size="lg" className="border-white/20 bg-white/5 text-ink-foreground hover:bg-white/10">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                  <path d="M3.6 2.3c-.2.3-.3.7-.3 1.2v17c0 .5.1.9.3 1.2l9.2-9.7L3.6 2.3zm10.5 8.4 2.6-2.7L6.3 2.2c-.3-.2-.6-.2-.9-.1l8.7 8.6zm3.9 1.3 2.5-1.4c.7-.4.7-1.1 0-1.5l-2.5-1.4-2.8 2.9 2.8 2.9zM5.4 21.9c.3.1.6.1.9-.1l10.4-5.8-2.6-2.7-8.7 8.6z" />
                </svg>
                Google Play
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex justify-center"
          >
            <img
              src={phoneImg}
              alt="Zealex Exchange mobile app on a smartphone"
              width={1008}
              height={1200}
              loading="lazy"
              className="w-64 drop-shadow-2xl sm:w-72"
            />
          </motion.div>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <motion.div {...fadeUp}>
            <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
              Frequently asked questions
            </h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need to know about trading on Zealex. Still curious? Our support team is
              available 24/7.
            </p>
            <Button variant="gold" className="mt-6">
              <Headphones className="h-4 w-4" /> Contact support
            </Button>
          </motion.div>

          <motion.div {...fadeUp}>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-border/60">
                  <AccordionTrigger className="text-left font-display text-base font-semibold hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </Section>

      {/* Final CTA */}
      <Section className="pb-20">
        <motion.div
          {...fadeUp}
          className="relative overflow-hidden rounded-[2rem] border border-gold/30 bg-gradient-gold p-10 text-center shadow-gold sm:p-16"
        >
          <h2 className="font-display text-3xl font-extrabold text-gold-foreground sm:text-4xl">
            Ready to get the best rate on your next trade?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-gold-foreground/80">
            Join thousands of traders getting paid faster with Zealex Exchange. Sign up in under a
            minute.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button variant="ink" size="xl" className="font-semibold">
              Create free account <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </Section>

      <Footer />
    </div>
  );
}

function RateRow({
  label,
  sub,
  badge,
  value,
  change,
  last,
}: {
  label: string;
  sub: string;
  badge: string;
  value: string;
  change: number;
  last?: boolean;
}) {
  const up = change >= 0;
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3.5",
        !last && "border-b border-border/60",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-xs font-bold text-foreground">
          {badge}
        </span>
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold">{value}</p>
        <p
          className={cn(
            "inline-flex items-center gap-0.5 text-xs font-semibold",
            up ? "text-success" : "text-destructive",
          )}
        >
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {up ? "+" : ""}
          {change}%
        </p>
      </div>
    </div>
  );
}

const features = [
  {
    icon: TrendingUp,
    title: "Best rates, guaranteed",
    desc: "Consistently high rates on gift cards and crypto, with zero hidden spreads or surprise deductions.",
  },
  {
    icon: Clock,
    title: "Instant payouts",
    desc: "Verified trades are paid to your Nigerian bank account in minutes, around the clock.",
  },
  {
    icon: ShieldCheck,
    title: "Bank-grade security",
    desc: "Two-factor authentication, encrypted storage, and tiered KYC keep your account protected.",
  },
  {
    icon: Wallet,
    title: "Unified wallet",
    desc: "Track available, pending, and locked balances in one clean, real-time wallet view.",
  },
  {
    icon: Landmark,
    title: "Saved accounts",
    desc: "Store favorite bank accounts and crypto wallets for faster repeat withdrawals.",
  },
  {
    icon: Headphones,
    title: "24/7 human support",
    desc: "A responsive support team available any time you need help with a trade.",
  },
];

const steps = [
  {
    icon: Gift,
    title: "Choose asset",
    desc: "Pick your gift card brand or cryptocurrency and enter the amount.",
  },
  {
    icon: UploadCloud,
    title: "Submit trade",
    desc: "Upload card images or send crypto to the generated wallet address.",
  },
  {
    icon: Lock,
    title: "Fast review",
    desc: "Our team verifies your trade — most are approved within minutes.",
  },
  {
    icon: Wallet,
    title: "Get paid",
    desc: "Funds land in your wallet or bank account instantly on approval.",
  },
];
