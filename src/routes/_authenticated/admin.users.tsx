import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Shield, ShieldOff, UserX, UserCheck, Ban } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useAdminUsers,
  useAdminRoles,
  useGrantRole,
  useRevokeRole,
  useSetProfileStatus,
} from "@/lib/admin-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/10 text-success",
  suspended: "bg-gold-soft text-foreground",
  banned: "bg-destructive/10 text-destructive",
};

function UsersPage() {
  const [search, setSearch] = useState("");
  const { data: users, isLoading } = useAdminUsers(search);
  const { data: roles } = useAdminRoles();
  const grant = useGrantRole();
  const revoke = useRevokeRole();
  const setStatus = useSetProfileStatus();

  const rolesByUser = new Map<string, Set<string>>();
  for (const r of roles ?? []) {
    if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, new Set());
    rolesByUser.get(r.user_id)!.add(r.role);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            {users?.length ?? 0} account{(users?.length ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, referral code"
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email · Phone</th>
                <th className="px-4 py-3">Referral</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-6 rounded bg-secondary" />
                    </td>
                  </tr>
                ))}
              {(users ?? []).map((u) => {
                const userRoles = Array.from(rolesByUser.get(u.id) ?? []);
                const isAdmin = userRoles.includes("admin") || userRoles.includes("super_admin");
                return (
                  <tr key={u.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-gold-soft font-bold uppercase">
                          {(u.full_name || u.email || "?").charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{u.full_name ?? "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate">{u.email ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{u.phone ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">
                        {u.referral_code ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">user</span>
                        ) : (
                          userRoles.map((r) => (
                            <span
                              key={r}
                              className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold uppercase"
                            >
                              {r}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          STATUS_STYLES[u.account_status] ?? "bg-secondary",
                        )}
                      >
                        {u.account_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline">
                            Manage
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Account status</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() =>
                              setStatus.mutate(
                                { id: u.id, status: "active" },
                                { onSuccess: () => toast.success("Activated") },
                              )
                            }
                          >
                            <UserCheck className="mr-2 h-4 w-4" /> Activate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setStatus.mutate(
                                { id: u.id, status: "suspended" },
                                { onSuccess: () => toast.success("Suspended") },
                              )
                            }
                          >
                            <UserX className="mr-2 h-4 w-4" /> Suspend
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setStatus.mutate(
                                { id: u.id, status: "banned" },
                                { onSuccess: () => toast.success("Banned") },
                              )
                            }
                          >
                            <Ban className="mr-2 h-4 w-4" /> Ban
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Roles</DropdownMenuLabel>
                          {isAdmin ? (
                            <DropdownMenuItem
                              onClick={() =>
                                revoke.mutate(
                                  { userId: u.id, role: "admin" },
                                  { onSuccess: () => toast.success("Admin removed") },
                                )
                              }
                            >
                              <ShieldOff className="mr-2 h-4 w-4" /> Remove admin
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() =>
                                grant.mutate(
                                  { userId: u.id, role: "admin" },
                                  { onSuccess: () => toast.success("Promoted to admin") },
                                )
                              }
                            >
                              <Shield className="mr-2 h-4 w-4" /> Promote to admin
                            </DropdownMenuItem>
                          )}
                          {["finance", "support", "kyc_officer", "moderator"].map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() => {
                                const has = rolesByUser.get(u.id)?.has(r);
                                if (has) {
                                  revoke.mutate(
                                    { userId: u.id, role: r },
                                    { onSuccess: () => toast.success(`Removed ${r}`) },
                                  );
                                } else {
                                  grant.mutate(
                                    { userId: u.id, role: r },
                                    { onSuccess: () => toast.success(`Granted ${r}`) },
                                  );
                                }
                              }}
                            >
                              {rolesByUser.get(u.id)?.has(r) ? (
                                <ShieldOff className="mr-2 h-4 w-4" />
                              ) : (
                                <Shield className="mr-2 h-4 w-4" />
                              )}
                              {rolesByUser.get(u.id)?.has(r) ? "Remove" : "Grant"} {r}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && (users ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No users match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
