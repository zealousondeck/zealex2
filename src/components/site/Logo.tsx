import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, invert = false }: { className?: string; invert?: boolean }) {
  return (
    <Link to="/" className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-ink shadow-soft">
        <span className="text-gradient-gold font-display text-lg font-extrabold leading-none">Z</span>
        <span className="absolute inset-0 rounded-xl ring-1 ring-gold/30" />
      </span>
      <span
        className={cn(
          "font-display text-lg font-extrabold tracking-tight",
          invert ? "text-ink-foreground" : "text-foreground",
        )}
      >
        ZEAlex
      </span>
    </Link>
  );
}
