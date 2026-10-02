import { cn } from "@/lib/utils";

type ZealexSpinnerSize = "sm" | "md" | "lg" | "page";

interface ZealexSpinnerProps {
  size?: ZealexSpinnerSize;
  className?: string;
  label?: string;
}

interface ZealexLoadingScreenProps {
  message?: string;
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

export function ZealexLoadingScreen({
  message = "Securing your connection",
}: ZealexLoadingScreenProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-background px-6"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="relative grid h-20 w-20 place-items-center sm:h-24 sm:w-24">
          <div className="absolute inset-0 rounded-full border border-gold/15" />
          <ZealexSpinner size="page" label={message} className="shadow-gold" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground sm:text-base">{message}</p>
          <div className="mx-auto h-0.5 w-12 overflow-hidden rounded-full bg-gold/20">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gold" />
          </div>
        </div>
      </div>
    </div>
  );
}
