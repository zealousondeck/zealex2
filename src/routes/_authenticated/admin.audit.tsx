import { createFileRoute } from "@tanstack/react-router";
import { useAuditLogs } from "@/lib/admin-data";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { data, isLoading } = useAuditLogs();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Every admin action is recorded here for accountability
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {(data ?? []).map((log) => (
                <tr key={log.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{log.admin_id?.slice(0, 8)}…</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold uppercase">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {log.entity_type ?? "—"}
                    {log.entity_id && (
                      <span className="ml-1 text-muted-foreground">· {log.entity_id.slice(0, 8)}…</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <pre className="truncate text-[11px] text-muted-foreground">
                      {log.details ? JSON.stringify(log.details) : ""}
                    </pre>
                  </td>
                </tr>
              ))}
              {!isLoading && (data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No admin actions recorded yet.
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
