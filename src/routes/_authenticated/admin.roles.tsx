import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Search, Shield, Trash2 } from "lucide-react";
import { useAdminUsers, useAdminRoles, useGrantRole, useRevokeRole } from "@/lib/admin-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS, ROLE_PERMISSIONS, useHasPermission, type StaffRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: RolesPage,
});

function RolesPage() {
  const { allowed } = useHasPermission("manage_roles");
  const [search, setSearch] = useState("");
  const { data: users } = useAdminUsers(search);
  const { data: roles } = useAdminRoles();
  const grant = useGrantRole();
  const revoke = useRevokeRole();
  const [pendingRole, setPendingRole] = useState<Record<string, StaffRole>>({});

  if (!allowed)
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
        Only Super Admins and Admins can manage roles.
      </div>
    );

  const rolesByUser = new Map<string, string[]>();
  for (const r of roles ?? []) {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push(r.role);
    rolesByUser.set(r.user_id, arr);
  }

  async function assign(uid: string) {
    const role = pendingRole[uid];
    if (!role) return toast.error("Pick a role");
    try {
      await grant.mutateAsync({ userId: uid, role });
      toast.success(`Granted ${ROLE_LABELS[role]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Role Management</h1>
        <p className="text-sm text-muted-foreground">
          Grant or revoke staff roles. Permissions apply immediately across the admin console.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 font-display text-lg font-bold">Role capabilities</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(ROLE_PERMISSIONS) as StaffRole[]).map((r) => (
            <div key={r} className="rounded-xl border border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gold" />
                <p className="font-bold">{ROLE_LABELS[r]}</p>
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                {ROLE_PERMISSIONS[r].map((p) => (
                  <li key={p}>· {p.replace(/_/g, " ")}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <p className="font-display text-lg font-bold">Users</p>
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Current roles</th>
                <th className="px-4 py-3 text-right">Grant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(users ?? []).map((u) => {
                const has = rolesByUser.get(u.id) ?? [];
                return (
                  <tr key={u.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{u.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {has.length === 0 && <span className="text-xs text-muted-foreground">user</span>}
                        {has.map((r) => (
                          <span key={r} className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold uppercase">
                            {ROLE_LABELS[r as StaffRole] ?? r}
                            {r !== "user" && (
                              <button
                                onClick={() => revoke.mutate({ userId: u.id, role: r })}
                                className="text-muted-foreground hover:text-destructive"
                                title="Revoke"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Select
                          value={pendingRole[u.id] ?? ""}
                          onValueChange={(v) => setPendingRole((s) => ({ ...s, [u.id]: v as StaffRole }))}
                        >
                          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Pick role" /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(ROLE_LABELS) as StaffRole[]).map((r) => (
                              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="gold" onClick={() => assign(u.id)}>Grant</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
