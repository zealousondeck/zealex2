import { Link } from "@tanstack/react-router";
import { Wallet, ArrowLeftRight, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", label: "Wallet", icon: Wallet, exact: true },
  { to: "/dashboard/exchange", label: "Exchange", icon: ArrowLeftRight, exact: false },
  { to: "/dashboard/notifications", label: "Alerts", icon: Bell, exact: false },
  { to: "/dashboard/profile", label: "Profile", icon: User, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact }}
            className="flex flex-col items-center gap-1 py-2.5 text-muted-foreground transition-colors"
            activeProps={{ className: "text-gold" }}
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-xl transition-colors",
                    isActive && "bg-gold-soft",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-semibold">{item.label}</span>
              </>
            )}
          </Link>
        ))}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
