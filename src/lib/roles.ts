import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STAFF_ROLES = [
  "admin",
  "super_admin",
  "finance",
  "support",
  "kyc_officer",
  "moderator",
];

export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async (): Promise<boolean> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;

      if (!uid) return false;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);

      if (error) {
        console.error(error);
        return false;
      }

      return (data ?? []).some((r) => STAFF_ROLES.includes(r.role));
    },
  });
}