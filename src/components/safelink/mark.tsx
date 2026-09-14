import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 56"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d="M24 2.5 L43 11.2 V28.5 C43 39.8 24 53 24 53 C24 53 5 39.8 5 28.5 V11.2 Z"
        fill="#0E1D2C"
        stroke="#E63946"
        strokeWidth="1.75"
      />
      <path d="M8.2 12.4 L24 5.2 L39.8 12.4 V15.1 L24 8 L8.2 15.1 Z" fill="#111" />
      <path d="M8.2 15.1 L24 8 L39.8 15.1 V17.6 L24 10.6 L8.2 17.6 Z" fill="#FCDC04" />
      <path d="M8.2 17.6 L24 10.6 L39.8 17.6 V19.8 L24 12.9 L8.2 19.8 Z" fill="#D90000" />
      <rect x="21.2" y="22" width="5.6" height="18" rx="0.6" fill="#EAF1F7" />
      <rect x="14.2" y="27.2" width="19.6" height="5.6" rx="0.6" fill="#EAF1F7" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Mark className={compact ? "h-8 w-auto" : "h-10 w-auto"} />
      <div className="min-w-0 leading-none">
        <div
          className={cn(
            "font-semibold tracking-tight text-ink",
            compact ? "text-sm" : "text-base",
          )}
        >
          SafeLink
        </div>
        <div
          className={cn(
            "mt-0.5 font-mono uppercase tracking-[0.18em] text-mute",
            compact ? "text-[0.625rem]" : "text-[0.6875rem]",
          )}
        >
          Uganda
        </div>
      </div>
    </div>
  );
}
