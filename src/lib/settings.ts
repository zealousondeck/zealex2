import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./audit";

export type SettingsMap = Record<string, unknown>;

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async (): Promise<SettingsMap> => {
      const { data } = await supabase.from("app_settings").select("key, value");
      const map: SettingsMap = {};
      for (const r of (data ?? []) as { key: string; value: unknown }[]) {
        map[r.key] = r.value;
      }
      return map;
    },
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value: value as any, updated_by: uid ?? null }, { onConflict: "key" });
      if (error) throw error;
      await logAudit("settings.update", "app_settings", key, { value });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-settings"] }),
  });
}
