export const SLA_WARN_SEC = 4 * 60;
export const SLA_BREACH_SEC = 8 * 60;

export function slaSeconds(reportedAt: number, now = Date.now()): number {
  if (!reportedAt) return 0;
  return Math.max(0, Math.floor((now - reportedAt) / 1000));
}

export function formatSla(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function slaTone(seconds: number): "ok" | "amber" | "alert" {
  if (seconds >= SLA_BREACH_SEC) return "alert";
  if (seconds >= SLA_WARN_SEC) return "amber";
  return "ok";
}
