import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "./audit";

export type NotificationHistory = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  category: string;
  read: boolean;
  created_at: string;
};

export function useNotificationHistory(search: string, category: string) {
  return useQuery({
    queryKey: ["admin", "notif-history", search, category],
    queryFn: async (): Promise<NotificationHistory[]> => {
      let q = supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (category !== "all") q = q.eq("category", category);
      if (search) q = q.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NotificationHistory[];
    },
  });
}

export function useSendBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      title,
      body,
      category,
      targetUserId,
      email,
    }: {
      title: string;
      body: string;
      category: string;
      targetUserId?: string;
      email?: boolean;
    }) => {
      let userIds: string[];
      if (targetUserId) {
        userIds = [targetUserId];
      } else {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("account_status", "active");
        if (error) throw error;
        userIds = (profiles ?? []).map((p) => p.id);
      }
      if (userIds.length === 0) throw new Error("No recipients found");
      // Chunk inserts to keep payloads reasonable
      const rows = userIds.map((uid) => ({
        user_id: uid,
        title,
        body,
        category,
      }));
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { error } = await supabase.from("notifications").insert(slice);
        if (error) throw error;
      }
      await logAudit("notification.broadcast", "notifications", undefined, {
        recipients: userIds.length,
        title,
        category,
        email: !!email,
        target: targetUserId ?? "all",
      });
      return { recipients: userIds.length, emailQueued: !!email };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "notif-history"] }),
  });
}
