import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Megaphone, Loader2, Wrench, Gift, Info, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/announcements")({
  component: AnnouncementsPage,
});

type Announcement = {
  id: string;
  title: string;
  body: string;
  category: string;
  active: boolean;
  created_at: string;
};

const CATS = {
  maintenance: { label: "Maintenance", icon: Wrench, color: "bg-destructive/10 text-destructive" },
  promotion: { label: "Promotion", icon: Gift, color: "bg-gold-soft text-foreground" },
  update: { label: "Update", icon: Info, color: "bg-secondary text-foreground" },
} as const;

function AnnouncementsPage() {
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as Announcement[];
    },
  });

  const { data: reads = [] } = useQuery({
    queryKey: ["announcement-reads"],
    queryFn: async () => {
      const { data } = await supabase.from("announcement_reads").select("announcement_id");
      return (data ?? []).map((r: any) => r.announcement_id as string);
    },
  });
  const readSet = new Set(reads);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      await supabase.from("announcement_reads").upsert({ announcement_id: id, user_id: uid });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcement-reads"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-soft text-foreground">
          <Megaphone className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-sm text-muted-foreground">Latest updates from ZEAlex.</p>
        </div>
      </div>

      {isAdmin && <AdminPublisher />}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : announcements.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No announcements yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => {
            const meta = CATS[a.category as keyof typeof CATS] ?? CATS.update;
            const Icon = meta.icon;
            const unread = !readSet.has(a.id);
            return (
              <li
                key={a.id}
                onClick={() => unread && markRead.mutate(a.id)}
                className={cn(
                  "cursor-pointer rounded-2xl border p-5 transition-colors",
                  unread ? "border-gold bg-gold-soft/40" : "border-border bg-card",
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", meta.color)}>
                    <Icon className="h-3 w-3" /> {meta.label}
                  </span>
                  {unread && (
                    <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground">
                      NEW
                    </span>
                  )}
                  {!a.active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      Hidden
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-bold">{a.title}</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
                {isAdmin && <AdminActions a={a} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AdminPublisher() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("update");
  const [submitting, setSubmitting] = useState(false);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !body) return toast.error("Title and body required");
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("announcements").insert({
        title, body, category, active: true, published_by: userData.user?.id,
      });
      if (error) throw error;
      toast.success("Announcement published");
      setTitle(""); setBody("");
      qc.invalidateQueries({ queryKey: ["announcements"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={publish} className="space-y-4 rounded-2xl border border-gold bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-gold">Admin · Publish</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="promotion">Promotion</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="body">Body</Label>
        <Textarea id="body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} />
      </div>
      <Button type="submit" variant="gold" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Publish
      </Button>
    </form>
  );
}

function AdminActions({ a }: { a: Announcement }) {
  const qc = useQueryClient();
  async function toggle() {
    await supabase.from("announcements").update({ active: !a.active }).eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }
  async function remove() {
    if (!confirm("Delete announcement?")) return;
    await supabase.from("announcements").delete().eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }
  return (
    <div className="mt-3 flex gap-2 border-t border-border pt-3">
      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); toggle(); }}>
        {a.active ? "Hide" : "Show"}
      </Button>
      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); remove(); }}>
        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
      </Button>
    </div>
  );
}
