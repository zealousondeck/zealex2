import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const links = [
  { label: "Rates", href: "#rates" },
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 shadow-soft backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:flex lg:justify-between lg:px-8">
        <div className="flex items-center lg:order-1">
          <button
            className="grid h-10 w-10 place-items-center rounded-xl text-foreground transition-colors hover:bg-secondary lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Logo className="hidden lg:inline-flex" />
        </div>

        <div className="justify-self-center lg:hidden">
          <Logo />
        </div>

        <nav className="hidden items-center gap-1 lg:order-2 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:order-3 lg:flex">
          <Button variant="ghost" className="font-semibold" asChild>
            <Link to="/auth">Log in</Link>
          </Button>
          <Button variant="gold" className="font-semibold" asChild>
            <Link to="/auth">Get started</Link>
          </Button>
        </div>

        <Link
          to="/auth"
          aria-label="Account"
          className="grid h-10 w-10 justify-self-end place-items-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:border-gold/60 hover:bg-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          <UserRound className="h-5 w-5" />
        </Link>
      </div>

      <div
        className={cn(
          "absolute inset-x-0 top-full overflow-hidden border-b border-border bg-card shadow-card transition-[max-height] duration-300 lg:hidden",
          open ? "max-h-[32rem]" : "max-h-0",
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            <Button variant="outline" className="w-full font-semibold" asChild>
              <Link to="/auth">Log in</Link>
            </Button>
            <Button variant="gold" className="w-full font-semibold" asChild>
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
