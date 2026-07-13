import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCheck, Info, ArrowLeftRight, ShieldCheck } from "lucide-react";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from "@/lib/dashboard-data";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/notifications")({
  component: NotificationsPage,
});

function iconFor(category: string) {
  if (category === "transaction") return ArrowLeftRight;
  if (category === "security") return ShieldCheck;
  if (category === "system") return Info;
  return Bell;
}

function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </p>
        </div>
        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 font-semibold"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (notifications ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
              <Bell className="h-6 w-6" />
            </span>
            <p className="font-semibold">No notifications yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {(notifications ?? []).map((n) => (
              <NotificationRow key={n.id} n={n} onRead={() => markRead.mutate(n.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NotificationRow({
  n,
  onRead,
}: {
  n: AppNotification;
  onRead: () => void;
}) {
  const Icon = iconFor(n.category);
  return (
    <li
      className={cn(
        "flex items-start gap-3 px-4 py-4 transition-colors",
        !n.read && "bg-gold-soft/40",
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{n.title}</p>
          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-gold" />}
        </div>
        {n.body && (
          <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(n.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
      {!n.read && (
        <button
          onClick={onRead}
          className="shrink-0 text-xs font-semibold text-gold hover:underline"
        >
          Mark read
        </button>
      )}
    </li>
  );
}
