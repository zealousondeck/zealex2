import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  ArrowLeftRight,
  Bell,
  User,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { BottomNav } from "@/components/dashboard/BottomNav";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { ThemeProvider } from "@/lib/theme";
import { useNotifications, useRealtimeSync } from "@/lib/dashboard-data";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

const navItems = [
  { to: "/dashboard", label: "Wallet", icon: Wallet, exact: true },
  { to: "/dashboard/exchange", label: "Exchange", icon: ArrowLeftRight, exact: false },
  { to: "/dashboard/notifications", label: "Notifications", icon: Bell, exact: false },
  { to: "/dashboard/profile", label: "Profile", icon: User, exact: false },
] as const;

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
  const queryClient = useQueryClient();
  const { data: notifications } = useNotifications();
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card px-4 py-6 md:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-gold-soft text-foreground" }}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.label}</span>
              {item.label === "Notifications" && unread > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-xs font-bold text-gold-foreground">
                  {unread}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <Button
          variant="ghost"
          className="justify-start gap-3 font-semibold text-muted-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </Button>
      </aside>

      <div className="md:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure session
            </span>
            <div className="md:hidden">
              <Logo />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/notifications"
              className={cn(
                "relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-secondary",
              )}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
                  {unread}
                </span>
              )}
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 md:pb-10">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
