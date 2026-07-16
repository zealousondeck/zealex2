import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/kyc")({
  component: () => (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">KYC Review</h1>
        <p className="text-sm text-muted-foreground">
          Full document review console with signed image previews.
        </p>
      </div>
      <Link
        to="/dashboard/kyc"
        className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 font-semibold hover:bg-secondary"
      >
        Open the KYC queue <ArrowRight className="h-4 w-4" />
      </Link>
      <p className="text-xs text-muted-foreground">
        The reviewer console lives on the user dashboard for admins — approve, reject with notes,
        and download uploaded documents there.
      </p>
    </div>
  ),
});
