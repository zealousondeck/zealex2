import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut, Loader2, ShieldCheck, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/lib/dashboard-data";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone, updated_at: new Date().toISOString() })
        .eq("id", uid);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  const initials =
    (profile?.full_name ?? profile?.email ?? "Z")
      .split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "Z";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-gold text-lg font-bold text-gold-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {isLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            <p className="truncate text-lg font-bold">
              {profile?.full_name ?? "ZEAlex user"}
            </p>
          )}
          <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> {profile?.email}
          </p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
            <ShieldCheck className="h-3 w-3" /> Verified account
          </span>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-2xl border border-border bg-card p-5"
      >
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234…"
              className="pl-9"
              maxLength={20}
            />
          </div>
        </div>
        <Button type="submit" variant="gold" className="font-bold" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </form>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
        <div>
          <p className="font-semibold">Appearance</p>
          <p className="text-sm text-muted-foreground">Toggle light or dark mode</p>
        </div>
        <ThemeToggle />
      </div>

      <Button
        variant="outline"
        className="w-full gap-2 font-semibold text-destructive"
        onClick={handleSignOut}
      >
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
