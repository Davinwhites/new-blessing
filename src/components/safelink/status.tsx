import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { IncidentStatus, UnitStatus } from "@/lib/safelink/types";
import { cn } from "@/lib/utils";

const INCIDENT_TONE: Record<IncidentStatus, "mute" | "amber" | "alert" | "ok"> =
  {
    reported: "mute",
    dispatched: "amber",
    enroute: "amber",
    onscene: "alert",
    resolved: "ok",
    escalated: "alert",
  };

export function StatusBadge({ status }: { status: IncidentStatus | string }) {
  const tone = INCIDENT_TONE[status as IncidentStatus] ?? "mute";
  return <Badge tone={tone}>{status}</Badge>;
}

export function UnitBadge({ status }: { status: UnitStatus | string }) {
  const tone =
    status === "available" ? "ok" : status === "enroute" ? "amber" : "alert";
  return <Badge tone={tone}>{status}</Badge>;
}

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "alert" | "amber" | "ok" | "ink";
}) {
  const color =
    tone === "alert"
      ? "text-alert"
      : tone === "amber"
        ? "text-amber"
        : tone === "ok"
          ? "text-ok"
          : "text-ink";
  const rail =
    tone === "alert"
      ? "bg-alert"
      : tone === "amber"
        ? "bg-amber"
        : tone === "ok"
          ? "bg-ok"
          : "bg-line-strong";
  return (
    <div className="relative overflow-hidden rounded-xl bg-panel p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.07)]">
      <span className={cn("absolute inset-y-0 left-0 w-0.5", rail)} />
      <div className={cn("font-mono text-2xl font-semibold tabular-nums", color)}>
        {value}
      </div>
      <div className="mt-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-mute">
        {label}
      </div>
    </div>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "crit";
  children: ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "bg-ok/10 border-ok/35 text-ok"
      : tone === "warn"
        ? "bg-amber/10 border-amber/35 text-amber"
        : "bg-alert/10 border-alert/40 text-[#ff8a92]";
  return (
    <div className={cn("mb-3 rounded-lg border px-3.5 py-3 text-sm", cls)}>
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.08em] text-mute">
        {label}
      </div>
      {children}
    </div>
  );
}

export function PageHead({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="mb-6">
      <h1 className="m-0 text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-mute">{sub}</p>
    </header>
  );
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full border-collapse text-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-line px-2 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-mute"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({
  cols,
  children,
}: {
  cols: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={cols} className="px-2 py-10 text-center text-sm text-mute">
        {children}
      </td>
    </tr>
  );
}

export function Td({
  children,
  mono,
  className = "",
}: {
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-b border-line px-2 py-2.5 align-middle",
        mono && "font-mono text-xs",
        className,
      )}
    >
      {children}
    </td>
  );
}
