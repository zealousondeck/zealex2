import { supabase } from "@/integrations/supabase/client";

/** Record an admin action for the audit trail. Fails silently — audit must never block UX. */
export async function logAudit(
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>,
) {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    await supabase.from("audit_logs").insert({
      admin_id: uid,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      details: (details ?? null) as any,
    });
  } catch {
    /* ignore */
  }
}
