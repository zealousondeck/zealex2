import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/announcements")({
  component: () => (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground">
          Publish maintenance notices and promotions to every signed-in user.
        </p>
      </div>
      <Link
        to="/dashboard/announcements"
        className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 font-semibold hover:bg-secondary"
      >
        Open the announcements composer <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  ),
});
