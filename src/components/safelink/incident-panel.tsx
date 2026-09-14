import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useOps } from "@/lib/safelink/store";
import { SlaClock } from "./clock";
import { StatusBadge, UnitBadge } from "./status";

export function IncidentPanel() {
  const id = useOps((s) => s.selectedIncidentId);
  const incidents = useOps((s) => s.incidents);
  const calls = useOps((s) => s.calls);
  const units = useOps((s) => s.units);
  const hospitals = useOps((s) => s.hospitals);
  const select = useOps((s) => s.selectIncident);
  const verify = useOps((s) => s.verifyCall);
  const backup = useOps((s) => s.requestBackup);
  const reassign = useOps((s) => s.reassignHospital);
  const advance = useOps((s) => s.advanceIncident);
  const assignManual = useOps((s) => s.assignManual);

  const inc = incidents.find((i) => i.id === id);
  if (!inc) return null;
  const call = calls.find((c) => c.incidentId === inc.id);
  const freeUnits = units.filter(
    (u) =>
      u.status === "available" &&
      u.type === "Ambulance" &&
      (u.country || "Uganda") === (inc.country || "Uganda"),
  );

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-navy/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) select(null);
      }}
    >
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-panel-2 p-5 shadow-[var(--shadow-elevated)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-amber">{inc.id}</div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{inc.type}</h2>
            <p className="mt-1 text-sm text-mute">{inc.location}</p>
          </div>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-md text-mute hover:text-ink"
            onClick={() => select(null)}
            aria-label="Close incident"
          >
            ×
          </button>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={inc.status} />
          <SlaClock reportedAt={inc.reportedAt} />
          {call && (
            <span className="font-mono text-xs text-mute">
              {call.channel} · {call.verified ? "verified" : "unverified"}
            </span>
          )}
        </div>
        <p className="mb-4 text-sm leading-relaxed text-ink">{inc.desc}</p>
        <dl className="mb-4 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="uppercase tracking-[0.08em] text-mute">Casualties</dt>
            <dd className="mt-0.5 font-mono text-sm">{inc.casualties}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.08em] text-mute">Region</dt>
            <dd className="mt-0.5 text-sm">{inc.region}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.08em] text-mute">Reporter</dt>
            <dd className="mt-0.5 text-sm">{inc.reporter}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-[0.08em] text-mute">Source</dt>
            <dd className="mt-0.5 text-sm">{inc.source}</dd>
          </div>
        </dl>
        <h3 className="mb-2 text-sm font-semibold">Assigned units</h3>
        <ul className="mb-4 space-y-2">
          {inc.assigned.length === 0 && (
            <li className="text-sm text-mute">None assigned yet.</li>
          )}
          {inc.assigned.map((a) => {
            const u = units.find((x) => x.id === a.unitId);
            return (
              <li
                key={a.unitId}
                className="flex items-center justify-between rounded-md bg-panel px-3 py-2 text-sm"
              >
                <span className="font-mono">
                  {a.unitId} · {a.type}
                </span>
                <span className="flex items-center gap-2 text-xs text-mute">
                  {a.dist} km · {a.eta} min
                  {u && <UnitBadge status={u.status} />}
                </span>
              </li>
            );
          })}
        </ul>
        {inc.hospitalLink && (
          <p className="mb-4 text-sm text-mute">
            Hospital: <b className="text-ink">{inc.hospitalLink.name}</b> ·{" "}
            {inc.hospitalLink.dist} km · {inc.hospitalLink.traumaReserved} bay(s)
          </p>
        )}
        <div className="mb-3">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.08em] text-mute">
            Reassign hospital
          </div>
          <NativeSelect
            value={inc.hospitalLink?.hospitalId || ""}
            onChange={(e) => reassign(inc.id, e.target.value)}
          >
            <option value="">— select hospital —</option>
            {hospitals
              .filter((h) => (h.country || "Uganda") === (inc.country || "Uganda"))
              .map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} · {h.traumaAvailable} bays
                </option>
              ))}
          </NativeSelect>
        </div>
        <div className="mb-4">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-[0.08em] text-mute">
            Manual assign
          </div>
          <NativeSelect
            defaultValue=""
            onChange={async (e) => {
              const v = e.target.value;
              if (!v) return;
              const msg = await assignManual(inc.id, v);
              if (msg) toast(msg);
              e.currentTarget.value = "";
            }}
          >
            <option value="">— available ambulance —</option>
            {freeUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id} · {u.agency} · {u.zone}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {call && !call.verified && (
            <Button
              size="sm"
              onClick={() => {
                verify(call.id);
                toast.success("Dispatch verified");
              }}
            >
              Verify dispatch
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => backup(inc.id)}>
            Backup ambulance
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => advance(inc.id, "onscene")}
          >
            Mark on scene
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              advance(inc.id, "resolved");
              select(null);
            }}
          >
            Resolve
          </Button>
        </div>
        <h3 className="mb-2 text-sm font-semibold">Event log</h3>
        <div className="space-y-1.5">
          {inc.log.map((line, i) => (
            <p key={i} className="font-mono text-xs leading-relaxed text-mute">
              {line}
            </p>
          ))}
        </div>
      </aside>
    </div>
  );
}
