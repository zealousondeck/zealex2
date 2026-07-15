import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Zealex mark — a BTC-style coin with a "Z" glyph struck through by two
 * vertical serifs, echoing the ₿ silhouette. Pure SVG, currency-token friendly.
 */
export function ZealexCoin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="zx-coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5C860" />
          <stop offset="55%" stopColor="#D9A441" />
          <stop offset="100%" stopColor="#8A5A15" />
        </linearGradient>
        <linearGradient id="zx-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE7A1" />
          <stop offset="100%" stopColor="#7A4B0F" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#zx-coin)" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="url(#zx-rim)" strokeWidth="2" />
      <circle cx="32" cy="32" r="25" fill="none" stroke="#00000022" strokeWidth="1" />
      {/* Two serif strokes (BTC-style ticks) */}
      <rect x="26" y="8" width="3.2" height="48" rx="1" fill="#1A120A" />
      <rect x="34.8" y="8" width="3.2" height="48" rx="1" fill="#1A120A" />
      {/* Z glyph */}
      <path
        d="M20 20 H44 L24 44 H44"
        fill="none"
        stroke="#1A120A"
        strokeWidth="6"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function Logo({ className, invert = false }: { className?: string; invert?: boolean }) {
  return (
    <Link to="/" className={cn("group inline-flex items-center gap-2.5", className)}>
      <ZealexCoin className="h-9 w-9 drop-shadow-sm transition-transform group-hover:rotate-6" />
      <span
        className={cn(
          "font-display text-lg font-extrabold tracking-tight",
          invert ? "text-ink-foreground" : "text-foreground",
        )}
      >
        Zealex
      </span>
    </Link>
  );
}
