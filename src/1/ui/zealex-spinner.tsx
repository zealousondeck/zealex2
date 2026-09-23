import { cn } from "@/lib/utils";

type ZealexSpinnerSize = "sm" | "md" | "lg" | "page";

interface ZealexSpinnerProps {
  size?: ZealexSpinnerSize;
  className?: string;
  label?: string;
}

const sizeClasses: Record<ZealexSpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-[3px]",
  lg: "h-12 w-12 border-4",
  page: "h-12 w-12 border-4 sm:h-16 sm:w-16",
};

/**
 * Zealex-branded loading spinner.
 *
 * Sizes:
 *  - sm: fits inside buttons and small rows
 *  - md: default for cards and sections
 *  - lg: large section loaders
 *  - page: centered full-page/route loader
 */
export function ZealexSpinner({
  size = "md",
  className,
  label = "Loading",
}: ZealexSpinnerProps) {
  const ring = (
    <div
      className={cn(
        "rounded-full border-gold/30 border-t-gold animate-spin",
        sizeClasses[size],
        className,
      )}
      role="status"
      aria-label={label}
    />
  );

  if (size === "page") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6">
        {ring}
        {label && (
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        )}
      </div>
    );
  }

  return ring;
}
