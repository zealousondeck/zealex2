import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  ArrowLeftRight,
  Bell,
  User,
  LogOut,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Megaphone,
  LayoutDashboard,
  Bitcoin,
  Gift,
  History,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { BottomNav } from "@/components/dashboard/BottomNav";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { ThemeProvider } from "@/lib/theme";
import { useNotifications, useRealtimeSync } from "@/lib/dashboard-data";
import { useIsAdmin } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { clearDepositAttempts } from "@/lib/deposit-attempts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

const walletItem = { to: "/dashboard", label: "Wallet", icon: Wallet, exact: true } as const;

const navItems = [
  { to: "/dashboard/deposit", label: "Deposit", icon: ArrowDownLeft, exact: false },
  { to: "/dashboard/withdraw", label: "Withdraw", icon: ArrowUpRight, exact: false },
  { to: "/dashboard/kyc", label: "Verification", icon: ShieldCheck, exact: false },
  { to: "/dashboard/referrals", label: "Referrals", icon: Users, exact: false },
  { to: "/dashboard/announcements", label: "Announcements", icon: Megaphone, exact: false },
  { to: "/dashboard/notifications", label: "Notifications", icon: Bell, exact: false },
  { to: "/dashboard/profile", label: "Profile", icon: User, exact: false },
] as const;

const exchangeGroup = {
  label: "Exchange",
  icon: ArrowLeftRight,
  items: [
    { to: "/dashboard/crypto", label: "Crypto Exchange", icon: Bitcoin, search: undefined },
    {
      to: "/dashboard/exchange",
      label: "Gift Card Exchange",
      icon: Gift,
      search: { tab: "giftcard" as const },
    },
    {
      to: "/dashboard/exchange-history",
      label: "Exchange History",
      icon: History,
      search: undefined,
    },
  ],
} as const;

function DashboardLayout() {
  return (
    <ThemeProvider>
      <DashboardInner />
    </ThemeProvider>
  );
}

function DashboardInner() {
  useRealtimeSync();

  const navigate = useNavigate();
  const locationHref = useRouterState({ select: (state) => state.location.href });
  const queryClient = useQueryClient();

  const { data: notifications } = useNotifications();
  const { data: isAdmin } = useIsAdmin();
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");

    const update = () => {
      setIsDesktop(media.matches);
      if (media.matches) setMobileNavOpen(false);
    };

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [locationHref]);

  // rest of DashboardInner...

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { data } = await supabase.auth.getUser();
    if (data.user?.id) clearDepositAttempts(data.user.id);
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 shadow-soft backdrop-blur-xl">
        <div className="relative mx-auto grid h-16 max-w-[1500px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-6 lg:flex lg:gap-8 lg:px-8">
          <div className="flex min-w-0 items-center justify-start lg:shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl lg:hidden"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileNavOpen}
              aria-controls="dashboard-mobile-nav"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden lg:block">
              <Logo />
            </div>
          </div>

          <div className="justify-self-center lg:hidden">
            <Logo />
          </div>

          <nav aria-label="Main navigation" className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
            <Link
              to={walletItem.to}
              activeOptions={{ exact: walletItem.exact }}
              className="rounded-full border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "!border-gold bg-gold-soft/60 text-foreground" }}
            >
              Wallet
            </Link>
            {exchangeGroup.items.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                search={item.search as never}
                className="whitespace-nowrap rounded-full border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "!border-gold bg-gold-soft/60 text-foreground" }}
              >
                {item.label === "Gift Card Exchange" ? "Gift Cards" : item.label === "Crypto Exchange" ? "Crypto" : "History"}
              </Link>
            ))}
            <Link
              to="/dashboard/deposit"
              className="whitespace-nowrap rounded-full border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "!border-gold bg-gold-soft/60 text-foreground" }}
            >
              Deposit
            </Link>
            <Link
              to="/dashboard/withdraw"
              className="whitespace-nowrap rounded-full border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "!border-gold bg-gold-soft/60 text-foreground" }}
            >
              Withdraw
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1 rounded-full px-3 text-sm font-semibold text-muted-foreground">
                  More <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-52 rounded-xl p-1.5">
                <DropdownMenuLabel className="px-3 py-2 text-xs text-muted-foreground">Your workspace</DropdownMenuLabel>
                {navItems.filter((item) => item.label === "Referrals" || item.label === "Announcements").map((item) => (
                  <DropdownMenuItem key={item.to} asChild className="rounded-lg px-3 py-2.5">
                    <Link to={item.to}><item.icon className="h-4 w-4" />{item.label}</Link>
                  </DropdownMenuItem>
                ))}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="rounded-lg px-3 py-2.5">
                      <Link to="/admin"><LayoutDashboard className="h-4 w-4" />Admin console</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="flex min-w-0 items-center justify-end gap-1 lg:ml-auto">
            <Link
              to="/dashboard/notifications"
              className="relative grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
                  {unread}
                </span>
              )}
            </Link>
            <ThemeToggle className="hidden h-10 w-10 rounded-full border-0 bg-transparent shadow-none hover:bg-secondary lg:grid" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full border-border bg-card shadow-sm hover:border-gold/60 hover:bg-gold-soft focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open profile menu"
                >
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} className="w-56 rounded-xl p-1.5">
                <DropdownMenuLabel className="px-3 py-2 text-xs text-muted-foreground">Account</DropdownMenuLabel>
                <DropdownMenuItem asChild className="rounded-lg px-3 py-2.5">
                  <Link to="/dashboard/profile"><User className="h-4 w-4" />Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-lg px-3 py-2.5">
                  <Link to="/dashboard/kyc"><ShieldCheck className="h-4 w-4" />Verification</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleSignOut()} className="rounded-lg px-3 py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <LogOut className="h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div
        className={cn("fixed inset-0 z-50 lg:hidden", mobileNavOpen ? "visible" : "invisible pointer-events-none")}
        aria-hidden={!mobileNavOpen}
      >
        <button
          type="button"
          tabIndex={mobileNavOpen ? 0 : -1}
          aria-label="Close navigation menu"
          className={cn("absolute inset-0 bg-foreground/25 backdrop-blur-[2px] transition-opacity duration-300", mobileNavOpen ? "opacity-100" : "opacity-0")}
          onClick={() => setMobileNavOpen(false)}
        />
        <nav
          id="dashboard-mobile-nav"
          aria-label="Mobile navigation"
          className={cn("absolute inset-y-0 left-0 flex h-full w-[85%] max-w-sm flex-col bg-card shadow-card transition-transform duration-300", mobileNavOpen ? "translate-x-0" : "-translate-x-full")}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
            <Logo />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-1 pb-2">
              <Link
                to={walletItem.to}
                activeOptions={{ exact: walletItem.exact }}
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-gold-soft text-foreground" }}
              >
                <walletItem.icon className="h-5 w-5" />{walletItem.label}
              </Link>
              <button
                type="button"
                onClick={() => setExchangeOpen((open) => !open)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-bold uppercase text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-expanded={exchangeOpen}
                aria-label={exchangeOpen ? "Collapse exchange menu" : "Expand exchange menu"}
              >
                <exchangeGroup.icon className="h-4 w-4" />
                <span className="flex-1">{exchangeGroup.label}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", exchangeOpen && "rotate-180")} />
              </button>
              {exchangeOpen && (
                <div className="ml-5 flex flex-col gap-1 border-l border-border pl-2">
                  {exchangeGroup.items.map((item) => (
                    <Link
                      key={item.label}
                      to={item.to}
                      search={item.search as never}
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      activeProps={{ className: "bg-gold-soft text-foreground" }}
                    >
                      <item.icon className="h-4 w-4" />{item.label}
                    </Link>
                  ))}
                </div>
              )}
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-gold-soft text-foreground" }}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="flex-1">{item.label}</span>
                  {item.label === "Notifications" && unread > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-xs font-bold text-gold-foreground">{unread}</span>
                  )}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setMobileNavOpen(false)}
                  className="mt-2 flex items-center gap-3 rounded-xl border border-gold/40 bg-gold-soft px-3 py-3 text-sm font-bold text-foreground transition-colors hover:bg-gold hover:text-gold-foreground"
                >
                  <LayoutDashboard className="h-5 w-5" /><span className="flex-1">Admin console</span>
                </Link>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <span className="text-sm font-semibold text-muted-foreground">Theme</span>
            <ThemeToggle className="rounded-full border-0 bg-transparent shadow-none hover:bg-secondary" />
          </div>
          <div className="shrink-0 px-4 pb-4">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-3 rounded-xl"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="h-5 w-5" />Logout
            </Button>
          </div>
        </nav>
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-7 sm:px-6 sm:pt-8 lg:pb-10 lg:px-8">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
