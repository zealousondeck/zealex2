import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Wallet,
  Megaphone,
  Settings as SettingsIcon,
  History,
  LogOut,
  Home,
  DollarSign,
  Bitcoin,
  Gift,
  Bell,
  Users2,
  KeyRound,
} from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { ThemeProvider } from "@/lib/theme";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMyPermissions, type Permission } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .in("role", ["admin", "super_admin", "finance", "support", "kyc_officer", "moderator"] as any);
    if (!data || data.length === 0) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: any; exact?: boolean; perm: Permission };

const NAV: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true, perm: "view_admin" },
  { to: "/admin/users", label: "Users", icon: Users, perm: "manage_users" },
  { to: "/admin/roles", label: "Roles", icon: KeyRound, perm: "manage_roles" },
  { to: "/admin/kyc", label: "KYC Review", icon: ShieldCheck, perm: "review_kyc" },
  { to: "/admin/rates", label: "Rates", icon: DollarSign, perm: "manage_rates" },
  { to: "/admin/exchange", label: "Crypto Orders", icon: Bitcoin, perm: "manage_transactions" },
  { to: "/admin/giftcards", label: "Gift Cards", icon: Gift, perm: "manage_transactions" },
  { to: "/admin/deposits", label: "Deposits", icon: ArrowDownLeft, perm: "manage_deposits" },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowUpRight, perm: "manage_withdrawals" },
  { to: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight, perm: "manage_transactions" },
  { to: "/admin/wallets", label: "Wallets", icon: Wallet, perm: "manage_wallets" },
  { to: "/admin/referrals", label: "Referrals", icon: Users2, perm: "manage_referrals" },
  { to: "/admin/notifications", label: "Notifications", icon: Bell, perm: "send_notifications" },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone, perm: "manage_announcements" },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon, perm: "manage_settings" },
  { to: "/admin/audit", label: "Audit Logs", icon: History, perm: "view_audit" },
];

function AdminLayout() {
  return (
    <ThemeProvider>
      <Inner />
    </ThemeProvider>
  );
}

function Inner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { permissions } = useMyPermissions();
  const visible = NAV.filter((n) => permissions.has(n.perm));

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card px-4 py-6 md:flex">
        <div className="flex items-center justify-between px-2">
          <Logo />
          <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gold-foreground">
            Admin
          </span>
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto">
          {visible.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-gold-soft text-foreground" }}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex flex-col gap-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Home className="h-4 w-4" /> User dashboard
          </Link>
          <Button variant="ghost" className="justify-start gap-3 font-semibold text-muted-foreground" onClick={signOut}>
            <LogOut className="h-5 w-5" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <Logo />
            <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gold-foreground">
              Admin
            </span>
          </div>
          <div className="hidden text-sm font-semibold text-muted-foreground md:block">
            Zealex Admin Console
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <div className="border-b border-border bg-card md:hidden">
          <div className="scrollbar-none flex gap-1 overflow-x-auto px-2 py-2">
            {visible.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                activeProps={{ className: "bg-gold-soft text-foreground" }}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
