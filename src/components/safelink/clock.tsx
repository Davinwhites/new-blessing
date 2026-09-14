import { useEffect, useState } from "react";
import { formatSla, slaSeconds, slaTone } from "@/lib/safelink/sla";
import { cn } from "@/lib/utils";

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

export function KampalaClock() {
  const [t, setT] = useState("");

  useEffect(() => {
    const tick = () => {
      setT(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Kampala",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time
      dateTime={t}
      className="font-mono text-xs tabular-nums text-mute"
      title="Africa/Kampala"
    >
      <span className="hidden lg:inline">Kampala </span>
      {t || "—:—:—"}
    </time>
  );
}

export function SlaClock({
  reportedAt,
  compact,
}: {
  reportedAt: number;
  compact?: boolean;
}) {
  const now = useNow(1000);
  const sec = slaSeconds(reportedAt, now);
  const tone = slaTone(sec);
  const color =
    tone === "alert" ? "text-alert" : tone === "amber" ? "text-amber" : "text-ok";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono tabular-nums",
        compact ? "text-xs" : "text-sm",
        color,
        tone === "alert" && "pulse-alert",
      )}
      title="Time since report (8 min target)"
    >
      <span className="text-[0.625rem] uppercase tracking-[0.08em] text-mute">
        SLA
      </span>
      {formatSla(sec)}
    </span>
  );
}
