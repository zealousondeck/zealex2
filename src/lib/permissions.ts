import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffRole =
  | "super_admin"
  | "admin"
  | "finance"
  | "support"
  | "kyc_officer"
  | "moderator";

export type Permission =
  | "view_admin"
  | "manage_users"
  | "manage_roles"
  | "manage_rates"
  | "manage_deposits"
  | "manage_withdrawals"
  | "manage_transactions"
  | "review_kyc"
  | "manage_wallets"
  | "manage_announcements"
  | "send_notifications"
  | "manage_referrals"
  | "view_audit"
  | "manage_settings";

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  super_admin: [
    "view_admin",
    "manage_users",
    "manage_roles",
    "manage_rates",
    "manage_deposits",
    "manage_withdrawals",
    "manage_transactions",
    "review_kyc",
    "manage_wallets",
    "manage_announcements",
    "send_notifications",
    "manage_referrals",
    "view_audit",
    "manage_settings",
  ],
  admin: [
    "view_admin",
    "manage_users",
    "manage_rates",
    "manage_deposits",
    "manage_withdrawals",
    "manage_transactions",
    "review_kyc",
    "manage_wallets",
    "manage_announcements",
    "send_notifications",
    "manage_referrals",
    "view_audit",
    "manage_settings",
  ],
  finance: [
    "view_admin",
    "manage_rates",
    "manage_deposits",
    "manage_withdrawals",
    "manage_transactions",
    "manage_wallets",
    "manage_referrals",
  ],
  support: [
    "view_admin",
    "manage_users",
    "send_notifications",
    "manage_announcements",
  ],
  kyc_officer: ["view_admin", "review_kyc"],
  moderator: ["view_admin", "manage_announcements", "send_notifications"],
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  finance: "Finance",
  support: "Support",
  kyc_officer: "KYC Officer",
  moderator: "Moderator",
};

export function useMyRoles() {
  return useQuery({
    queryKey: ["my-roles"],
    queryFn: async (): Promise<StaffRole[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      return (data ?? [])
        .map((r) => r.role as string)
        .filter((r): r is StaffRole => r in ROLE_PERMISSIONS);
    },
  });
}

export function permissionsFor(roles: StaffRole[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) {
    for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p);
  }
  return set;
}

export function useMyPermissions() {
  const { data: roles = [], isLoading } = useMyRoles();
  return { roles, permissions: permissionsFor(roles), isLoading };
}

export function useHasPermission(p: Permission) {
  const { permissions, isLoading } = useMyPermissions();
  return { allowed: permissions.has(p), isLoading };
}
