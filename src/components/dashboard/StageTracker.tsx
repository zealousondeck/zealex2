import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STAGES = ["submitted", "under_review", "approved", "paid"] as const;
export type Stage = (typeof STAGES)[number];

const LABELS: Record<Stage, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  paid: "Paid",
};

export function StageTracker({ stage, compact = false }: { stage: string; compact?: boolean }) {
  const currentIndex = Math.max(0, STAGES.indexOf((stage as Stage) ?? "submitted"));
  return (
    <ol className={cn("flex items-center", compact ? "gap-1" : "gap-2")}>
      {STAGES.map((s, i) => {
        const done = i <= currentIndex;
        const active = i === currentIndex;
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "grid place-items-center rounded-full border text-[10px] font-bold transition-colors",
                  compact ? "h-5 w-5" : "h-7 w-7 text-xs",
                  done
                    ? "border-gold bg-gold text-gold-foreground"
                    : "border-border bg-card text-muted-foreground",
                  active && !done && "border-gold text-gold",
                )}
              >
                {done ? <Check className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} /> : i + 1}
              </span>
              {!compact && (
                <span
                  className={cn(
                    "whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide",
                    done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {LABELS[s]}
                </span>
              )}
            </div>
            {i < STAGES.length - 1 && (
              <span
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  i < currentIndex ? "bg-gold" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
