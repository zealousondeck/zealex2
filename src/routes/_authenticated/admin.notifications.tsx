import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Send, Search } from "lucide-react";
import { useSendBroadcast, useNotificationHistory } from "@/lib/admin-notify";
import { useAdminUsers } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHasPermission } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: NotificationsAdmin,
});

function NotificationsAdmin() {
  const { allowed } = useHasPermission("send_notifications");
  if (!allowed)
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
        You don't have permission to send notifications.
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Send in-app messages to one user or all active users, and browse history.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <SendCard />
        <HistoryCard />
      </div>
    </div>
  );
}

function SendCard() {
  const send = useSendBroadcast();
  const [audience, setAudience] = useState<"all" | "one">("all");
  const [userSearch, setUserSearch] = useState("");
  const { data: users } = useAdminUsers(userSearch);
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("system");
  const [pushOpt, setPushOpt] = useState(true);
  const [emailOpt, setEmailOpt] = useState(false);

  async function submit() {
    if (!title.trim()) return toast.error("Title required");
    if (audience === "one" && !userId) return toast.error("Select a user");
    try {
      const res = await send.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        category,
        targetUserId: audience === "one" ? userId : undefined,
        email: emailOpt,
      });
      toast.success(`Sent to ${res.recipients} recipient(s)`);
      setTitle("");
      setBody("");
      setUserId("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <p className="font-display text-lg font-bold">Compose</p>

      <div className="space-y-2">
        <Label>Audience</Label>
        <div className="flex gap-2">
          <Button variant={audience === "all" ? "gold" : "outline"} size="sm" className="flex-1" onClick={() => setAudience("all")}>
            All users
          </Button>
          <Button variant={audience === "one" ? "gold" : "outline"} size="sm" className="flex-1" onClick={() => setAudience("one")}>
            Single user
          </Button>
        </div>
      </div>

      {audience === "one" && (
        <div className="space-y-2">
          <Label>Search user</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Name or email" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
          </div>
          <div className="max-h-40 overflow-y-auto rounded-xl border border-border">
            {(users ?? []).slice(0, 20).map((u) => (
              <button
                key={u.id}
                onClick={() => setUserId(u.id)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-secondary/40 ${userId === u.id ? "bg-gold-soft" : ""}`}
              >
                <span className="font-semibold">{u.full_name ?? u.email ?? u.id.slice(0, 8)}</span>
                <span className="text-muted-foreground">{u.email}</span>
              </button>
            ))}
            {(users ?? []).length === 0 && <p className="p-3 text-xs text-muted-foreground">No users</p>}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="promo">Promotion</SelectItem>
            <SelectItem value="security">Security</SelectItem>
            <SelectItem value="transaction">Transaction</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scheduled maintenance" />
      </div>
      <div className="space-y-2">
        <Label>Message</Label>
        <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details users should know…" />
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <Checkbox checked={pushOpt} onCheckedChange={(v) => setPushOpt(!!v)} />
          In-app / push notification
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <Checkbox checked={emailOpt} onCheckedChange={(v) => setEmailOpt(!!v)} />
          Also send email
          <span className="text-[10px] font-normal text-muted-foreground">(requires email domain setup)</span>
        </label>
      </div>

      <Button variant="gold" className="w-full" onClick={submit} disabled={send.isPending}>
        <Send className="mr-2 h-4 w-4" /> {send.isPending ? "Sending…" : "Send notification"}
      </Button>
    </div>
  );
}

function HistoryCard() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const { data, isLoading } = useNotificationHistory(q, cat);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-lg font-bold">History</p>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search title/body" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="promo">Promotion</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="transaction">Transaction</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {(data ?? []).length === 0 && !isLoading && (
          <p className="p-6 text-center text-sm text-muted-foreground">No notifications match.</p>
        )}
        <ul className="divide-y divide-border">
          {(data ?? []).map((n) => (
            <li key={n.id} className="px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase">{n.category}</span>
                <p className="font-semibold">{n.title}</p>
                {!n.read && <span className="ml-auto text-[10px] font-bold text-gold">UNREAD</span>}
              </div>
              {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString()} · to {n.user_id.slice(0, 8)}…
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
