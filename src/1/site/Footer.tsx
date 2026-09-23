import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const columns = [
  {
    title: "Products",
    links: ["Gift card exchange", "Crypto exchange", "Wallet", "Referral program"],
  },
  {
    title: "Company",
    links: ["About us", "Careers", "Press", "Contact"],
  },
  {
    title: "Support",
    links: ["Help center", "Rate updates", "Security", "Status"],
  },
  {
    title: "Legal",
    links: ["Terms of service", "Privacy policy", "AML policy", "KYC policy"],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-ink text-ink-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Logo invert />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-foreground/60">
              Zealex Exchange is the premium way to trade gift cards and cryptocurrency at the best
              rates — with instant payouts and bank-grade security.
            </p>
            <form
              className="mt-6 flex max-w-sm gap-2"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-foreground/40" />
                <Input
                  type="email"
                  required
                  placeholder="Email for rate alerts"
                  className="h-11 border-white/15 bg-white/5 pl-9 text-ink-foreground placeholder:text-ink-foreground/40"
                />
              </div>
              <Button type="submit" variant="gold" className="h-11">
                Subscribe
              </Button>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="font-display text-sm font-bold">{col.title}</h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}>
                      <Link
                        to="/"
                        className="text-sm text-ink-foreground/60 transition-colors hover:text-gold"
                      >
                        {l}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm text-ink-foreground/50 sm:flex-row">
          <p>© {new Date().getFullYear()} Zealex Exchange. All rights reserved.</p>
          <p>Trade responsibly. Rates are subject to market conditions.</p>
        </div>
      </div>
    </footer>
  );
}
