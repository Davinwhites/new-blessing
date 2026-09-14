import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CERT_BODIES,
  EMERGENCY_TYPES,
  EMT_LEVELS,
  REGIONS,
} from "@/lib/safelink/constants";
import { LOCATIONS } from "@/lib/safelink/seed";
import { useOps } from "@/lib/safelink/store";
import { SlaClock } from "./clock";
import { OpsMap } from "./ops-map";
import {
  Alert,
  DataTable,
  EmptyRow,
  Field,
  PageHead,
  StatCard,
  StatusBadge,
  Td,
  UnitBadge,
} from "./status";

export function CallIntegrationView() {
  const calls = useOps((s) => s.calls);
  const incidents = useOps((s) => s.incidents);
  const smsLog = useOps((s) => s.smsLog);
  const channelCalls = calls.filter(
    (c) =>
      c.channel === "USSD" || c.channel === "Voice" || c.channel === "WhatsApp",
  );

  return (
    <div>
      <PageHead
        title="Call, USSD & WhatsApp Integration"
        sub="Reachable from any phone, on any network, with or without a data connection."
      />
      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            num: "919",
            lbl: "Direct Emergency Line",
            sub: "Voice call, routed through the CTI gateway straight to the National Dispatch Control Centre. Free to dial across MTN, Airtel, Lyca and UTL.",
          },
          {
            num: "*919#",
            lbl: "USSD Self-Service Code",
            sub: "Session-based menu for reporting, checking status, or finding the nearest hospital — works on any 2G feature phone.",
          },
          {
            num: "0800 191 911",
            lbl: "Toll-Free Backup Line",
            sub: "Secondary voice line for callers whose network can't route short code 919, and for partner agencies verifying a dispatch.",
          },
          {
            num: "+256 919 000 001",
            lbl: "WhatsApp Chatbot",
            sub: "WhatsApp Business number — report an emergency, check status, or find a hospital by chat, with the same auto-dispatch logic as USSD.",
          },
        ].map((c) => (
          <div
            key={c.num}
            className="rounded-xl border border-line bg-panel p-4 text-center"
          >
            <div className="font-mono text-[22px] font-bold text-amber">
              {c.num}
            </div>
            <div className="mt-1.5 text-[11px] uppercase tracking-[0.08em] text-mute">
              {c.lbl}
            </div>
            <div className="mt-2 text-[11px] leading-relaxed text-ink">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardTitle>How the module fits together</CardTitle>
          <p className="text-[12.5px] leading-relaxed text-mute">
            A telecom aggregator terminates calls to <b className="text-ink">919</b>{" "}
            and USSD sessions on <b className="text-ink">*919#</b> at SafeLink's
            gateway. Voice is bridged into the same CTI layer used by the
            National Dispatch Control Centre. USSD and WhatsApp write into the
            same incidents and calls data as the app — a USSD report shows up in
            the Dispatcher's queue tagged with its channel.
          </p>
          <h3 className="mt-4 mb-2 text-sm font-semibold">USSD menu (*919#)</h3>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-line bg-panel-2 p-3 font-mono text-[11.5px] leading-relaxed text-mute">
{`CON Welcome to SafeLink Uganda
1. Report Emergency
2. Check Report Status
3. Nearby Hospitals
4. About SafeLink
> 1
CON What type of emergency?
1. Road Traffic Accident  2. Rail Crossing Collision
3. Medical Emergency      4. Fire  5. Other
> [location, then casualty count]
END Report received. Ref: INC-1050.
Nearest ambulance notified.`}
          </pre>
          <div className="mt-3 rounded-lg border border-line bg-panel-2 p-3 text-xs leading-relaxed text-mute">
            Live gateway traffic is shown below when the connected telecom and Meta providers deliver it. No simulated sessions are created in this app.
          </div>
        </Card>
        <div>
          <Card className="mb-4">
            <CardTitle>Gateway status</CardTitle>
            <DataTable headers={["Channel", "Status"]}>
              {[
                ["919 direct line", "ONLINE"],
                ["*919# USSD gateway", "ONLINE"],
                ["0800 191 911 toll-free", "ONLINE"],
                ["WhatsApp Business API", "ONLINE"],
                ["SMS gateway", "ONLINE"],
                ["CTI bridge → Control Centre", "CONNECTED"],
              ].map(([n, s]) => (
                <tr key={n}>
                  <Td>{n}</Td>
                  <Td>
                    <span className="float-right">
                      <Badge tone="ok">{s}</Badge>
                    </span>
                  </Td>
                </tr>
              ))}
            </DataTable>
          </Card>
          <Card className="mb-4">
            <CardTitle>
              Recent USSD, WhatsApp & call sessions
              <span className="font-mono text-[10.5px] font-normal text-mute">
                {channelCalls.length} session(s)
              </span>
            </CardTitle>
            <div className="max-h-[220px] overflow-y-auto">
              {channelCalls.length === 0 ? (
                <p className="text-[13px] text-mute">
                  No inbound USSD, WhatsApp, or voice sessions have been received yet.
                </p>
              ) : (
                channelCalls.slice(0, 20).map((c) => {
                  const inc = incidents.find((i) => i.id === c.incidentId);
                  return (
                    <div
                      key={c.id}
                      className="mb-2.5 rounded-lg bg-panel-2 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.07)]"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-mono text-[10.5px] text-amber">
                          {c.channel.toUpperCase()} · {c.time}
                        </span>
                        <StatusBadge status={inc?.status || "reported"} />
                      </div>
                      <div className="text-xs text-mute">
                        {inc ? inc.type + " — " + inc.location : c.from}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
          <Card className="mb-4">
            <CardTitle>
              SMS gateway log
              <span className="font-mono text-[10.5px] font-normal text-mute">
                {smsLog.length} sent
              </span>
            </CardTitle>
            <div className="max-h-[220px] overflow-y-auto">
              {smsLog.length === 0 ? (
                <p className="text-[13px] text-mute">No SMS sent yet this session.</p>
              ) : (
                smsLog.slice(0, 20).map((s) => (
                  <div
                    key={s.id}
                    className="mb-2.5 rounded-lg bg-panel-2 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.07)]"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-mono text-[10.5px] text-amber">
                        SMS → {s.phone}
                      </span>
                      <span className="text-[11px] text-mute">{s.time}</span>
                    </div>
                    <div className="text-xs text-mute">{s.text}</div>
                  </div>
                ))
              )}
            </div>
          </Card>
          <Card>
            <CardTitle>Registration status</CardTitle>
            <p className="text-xs leading-relaxed text-mute">
              <b className="text-ink">919</b> and{" "}
              <b className="text-ink">*919#</b> sit in the Uganda Communications
              Commission's reserved 900–999 emergency block, distinct from Police
              (999/112) and MoH ambulance (912). Formal allocation requires a UCC
              application plus interconnection with MTN, Airtel, Lyca and UTL.
              Shown here as the proposed scheme pending that registration.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function PublicReportView() {
  const fileReport = useOps((s) => s.fileReport);
  const lastId = useOps((s) => s.lastPublicIncidentId);
  const incident = useOps((s) =>
    s.lastPublicIncidentId
      ? s.incidents.find((i) => i.id === s.lastPublicIncidentId)
      : undefined,
  );
  const user = useOps((s) => s.session?.user || "citizen");
  const [alert, setAlert] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const locName = String(fd.get("location") || "");
    const loc = LOCATIONS.find((l) => l.name === locName) || LOCATIONS[0];
    const phone = String(fd.get("phone") || "").trim() || "+256 7XX XXX XXX";
    const inc = await fileReport({
      type: String(fd.get("type") || "Other"),
      location: loc.name,
      region: loc.region,
      lat: loc.lat,
      lng: loc.lng,
      casualties: parseInt(String(fd.get("casualties") || "1"), 10) || 1,
      desc: String(fd.get("desc") || ""),
      source: "Public app report",
      reporter: user,
      channel: "App",
      from: user,
      phone,
      verified: true,
    });
    setAlert(
      `Report sent. Incident ${inc.id} created and nearest units notified automatically. An SMS confirmation was sent to ${phone}.`,
    );
    toast.success(`${inc.id} filed — nearest units notified`);
  }

  return (
    <div>
      <PageHead
        title="Report an Emergency"
        sub="Your location is captured automatically. The dispatch engine will alert the nearest ambulance and police unit immediately."
      />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          {alert && <Alert tone="crit">{alert}</Alert>}
          <form onSubmit={onSubmit}>
            <Field label="Emergency type">
              <NativeSelect name="type">
                <option>Road traffic accident</option>
                <option>Rail crossing collision</option>
                <option>Medical emergency</option>
                <option>Fire</option>
                <option>Other</option>
              </NativeSelect>
            </Field>
            <Field label="Location">
              <NativeSelect name="location" defaultValue={LOCATIONS[0].name}>
                {LOCATIONS.map((l) => (
                  <option key={l.name}>{l.name}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="District or locality">
              <Input name="district" required placeholder="e.g. Kampala, Wakiso, Jinja" />
            </Field>
            <Field label="Estimated casualties">
              <Input name="casualties" defaultValue="1" />
            </Field>
            <Field label="Your phone number (for SMS updates)">
              <Input name="phone" defaultValue="+256 772 345 678" />
            </Field>
            <Field label="Description">
              <Textarea
                name="desc"
                defaultValue="Bus struck by train at level crossing, multiple injuries."
              />
            </Field>
            <Button type="submit" className="w-full">
              Send emergency report
            </Button>
          </form>
        </Card>
        <Card>
          <CardTitle>Your report status</CardTitle>
          {!lastId || !incident ? (
            <p className="text-[13px] text-mute">
              No report submitted yet in this session.
            </p>
          ) : (
            <div>
              <Alert tone="ok">
                Report received at {incident.time}. {incident.assigned.length}{" "}
                unit(s) dispatched.
              </Alert>
              <DataTable headers={["Unit", "Type", "Distance", "ETA"]}>
                {incident.assigned.map((a) => (
                  <tr key={a.unitId}>
                    <Td mono>{a.unitId}</Td>
                    <Td>{a.type}</Td>
                    <Td>{a.dist} km</Td>
                    <Td>{a.eta} min</Td>
                  </tr>
                ))}
              </DataTable>
              <p className="mt-2.5 text-xs text-mute">
                Status: <StatusBadge status={incident.status} />
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function EmtAssignmentsView() {
  const incidents = useOps((s) => s.incidents);
  const advance = useOps((s) => s.advanceIncident);
  const logIntake = useOps((s) => s.logIntake);
  const lastIntake = useOps((s) => s.lastIntake);
  const assigned = incidents.filter((i) =>
    i.assigned.some((a) => a.type === "Ambulance"),
  );

  function onIntake(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    logIntake(String(fd.get("triage")), String(fd.get("patients") || "1"));
  }

  return (
    <div>
      <PageHead
        title="My Assignments"
        sub="Incidents assigned to your unit, with navigation and patient intake."
      />
      <Card className="mb-4">
        <DataTable
          headers={["Incident", "Location", "Casualties", "Status", "Action"]}
        >
          {assigned.length === 0 ? (
            <EmptyRow cols={5}>No active assignments.</EmptyRow>
          ) : (
            assigned.map((i) => (
              <tr key={i.id}>
                <Td mono>{i.id}</Td>
                <Td>{i.location}</Td>
                <Td>{i.casualties}</Td>
                <Td>
                  <StatusBadge status={i.status} />
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => advance(i.id, "onscene")}
                    >
                      On scene
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => advance(i.id, "resolved")}
                    >
                      Resolve
                    </Button>
                  </div>
                </Td>
              </tr>
            ))
          )}
        </DataTable>
      </Card>
      <Card>
        <CardTitle>Patient intake — active incident</CardTitle>
        {lastIntake && <Alert tone="ok">{lastIntake}</Alert>}
        <form onSubmit={onIntake}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Triage category">
              <NativeSelect name="triage">
                <option>Red — immediate</option>
                <option>Yellow — delayed</option>
                <option>Green — minor</option>
                <option>Black — deceased</option>
              </NativeSelect>
            </Field>
            <Field label="Patients handled">
              <Input name="patients" defaultValue="1" />
            </Field>
          </div>
          <Button type="submit">Log intake & hospital handover</Button>
        </form>
      </Card>
    </div>
  );
}

export function EmtRegistryView() {
  const emts = useOps((s) => s.emts);
  const add = useOps((s) => s.addEmt);
  const toggle = useOps((s) => s.toggleEmtDuty);
  const [filter, setFilter] = useState("All");
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rows = emts.filter((x) => filter === "All" || x.region === filter);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const msg = await add({
      name: String(fd.get("name") || ""),
      level: String(fd.get("level") || ""),
      certBody: String(fd.get("cert") || ""),
      agency: String(fd.get("agency") || ""),
      region: String(fd.get("region") || "Central"),
      phone: String(fd.get("phone") || ""),
    });
    if (msg?.startsWith("Enter")) {
      setErr(msg);
      setOk(null);
    } else {
      setOk(msg);
      setErr(null);
      toast.success(msg);
      form.reset();
    }
  }

  return (
    <div>
      <PageHead
        title="EMT Registry"
        sub="Register and browse individual Emergency Medical Technicians, separate from the vehicle fleet."
      />
      <Card className="mb-4">
        <CardTitle>Register a new EMT</CardTitle>
        {err && <Alert tone="crit">{err}</Alert>}
        {ok && <Alert tone="ok">{ok}</Alert>}
        <form onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Field label="Full name">
                <Input name="name" placeholder="e.g. Namutebi Sarah" />
              </Field>
              <Field label="Certification level">
                <NativeSelect name="level">
                  {EMT_LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Certifying body">
                <NativeSelect name="cert">
                  {CERT_BODIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <div>
              <Field label="Agency / station">
                <Input name="agency" placeholder="e.g. Uganda Red Cross Society" />
              </Field>
              <Field label="Region">
                <NativeSelect name="region">
                  {REGIONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Contact phone">
                <Input name="phone" placeholder="+256 7XX XXX XXX" />
              </Field>
            </div>
          </div>
          <Button type="submit">Register EMT</Button>
        </form>
      </Card>
      <Card>
        <CardTitle>
          Registered EMTs
          <span className="font-mono text-[10.5px] font-normal text-mute">
            {rows.length} of {emts.length} registered
          </span>
        </CardTitle>
        <div className="mb-3">
          <NativeSelect
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="All">All regions</option>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </NativeSelect>
        </div>
        <DataTable
          headers={[
            "EMT ID",
            "Name",
            "Level",
            "Certifying Body",
            "Agency",
            "Region",
            "Phone",
            "Status",
          ]}
        >
          {rows.map((x) => (
            <tr key={x.id}>
              <Td mono>{x.id}</Td>
              <Td>{x.name}</Td>
              <Td>{x.level}</Td>
              <Td className="text-[11px] text-mute">{x.certBody}</Td>
              <Td>{x.agency}</Td>
              <Td className="text-amber">{x.region}</Td>
              <Td mono>{x.phone}</Td>
              <Td>
                <button type="button" onClick={() => toggle(x.id)}>
                  <Badge tone={x.status === "On Duty" ? "ok" : "mute"}>
                    {x.status}
                  </Badge>
                </button>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}

export function EmsConsoleView() {
  const units = useOps((s) => s.units);
  const incidents = useOps((s) => s.incidents);
  const toggle = useOps((s) => s.toggleUnitStatus);
  const myUnit = units.find((u) => u.id === "AMB-01") || units[0];
  const mine = incidents.filter((i) =>
    i.assigned.some((a) => a.unitId === myUnit?.id),
  );

  return (
    <div>
      <PageHead
        title="Unit Console"
        sub="Toggle your availability and view live dispatch assignments."
      />
      <Card className="mb-4">
        <CardTitle>Unit status</CardTitle>
        <div className="flex flex-wrap items-center gap-2.5">
          {myUnit && <UnitBadge status={myUnit.status} />}
          <span className="font-mono text-xs text-mute">{myUnit?.id}</span>
          <Button size="sm" variant="secondary" onClick={toggle}>
            Toggle status
          </Button>
        </div>
      </Card>
      <Card>
        <CardTitle>Assignment feed</CardTitle>
        {mine.length === 0 ? (
          <p className="text-[13px] text-mute">No active dispatch. Standing by.</p>
        ) : (
          mine.map((i) => {
            const a = i.assigned.find((x) => x.unitId === myUnit.id);
            return (
              <div
                key={i.id}
                className="mb-2.5 rounded-lg bg-panel-2 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.07)]"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <b>
                    {i.id} — {i.type}
                  </b>
                  <StatusBadge status={i.status} />
                </div>
                <div className="text-[12.5px] text-mute">{i.location}</div>
                {a && (
                  <div className="mt-1.5 text-xs">
                    Distance: <b>{a.dist} km</b> · ETA: <b>{a.eta} min</b> ·
                    Casualties: <b>{i.casualties}</b>
                  </div>
                )}
                {i.hospitalLink && (
                  <div className="mt-1 text-xs">
                    Take patient(s) to: <b>{i.hospitalLink.name}</b> ·{" "}
                    {i.hospitalLink.dist} km · ETA {i.hospitalLink.eta} min
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => useOps.getState().advanceIncident(i.id, "onscene")}
                  >
                    On scene
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => useOps.getState().advanceIncident(i.id, "resolved")}
                  >
                    Handover complete
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

function LogCallForm() {
  const fileReport = useOps((s) => s.fileReport);
  const user = useOps((s) => s.session?.user || "dispatcher");
  const [open, setOpen] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const locName = String(fd.get("location") || "");
    const loc = LOCATIONS.find((l) => l.name === locName) || LOCATIONS[0];
    const from = String(fd.get("from") || "").trim() || "+256 772 000 000";
    const inc = await fileReport({
      type: String(fd.get("type") || "Other"),
      location: loc.name,
      region: loc.region,
      lat: loc.lat,
      lng: loc.lng,
      casualties: parseInt(String(fd.get("casualties") || "1"), 10) || 1,
      desc: String(fd.get("desc") || "Inbound 919 voice call."),
      source: "Voice call — national emergency line 919",
      reporter: user,
      channel: "Voice",
      from,
      phone: from,
    });
    toast.success(`${inc.id} logged from 919`);
    form.reset();
    setOpen(false);
  }

  return (
    <Card className="mb-3.5">
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="mb-0">Log inbound 919 call</CardTitle>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "New call"}
        </Button>
      </div>
      {open && (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Emergency type">
            <NativeSelect name="type">
              {EMERGENCY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Location">
            <NativeSelect name="location" defaultValue={LOCATIONS[1].name}>
              {LOCATIONS.map((l) => (
                <option key={l.name}>{l.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Caller number">
            <Input name="from" defaultValue="+256 772 " />
          </Field>
          <Field label="Casualties">
            <Input name="casualties" defaultValue="1" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Notes">
              <Textarea name="desc" placeholder="What the caller reported..." />
            </Field>
            <Button type="submit">File into queue</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

export function DispatchQueueView() {
  const region = useOps((s) => s.regionFilter);
  const setRegion = useOps((s) => s.setRegionFilter);
  const incidents = useOps((s) => s.incidents);
  const calls = useOps((s) => s.calls);
  const units = useOps((s) => s.units);
  const hospitals = useOps((s) => s.hospitals);
  const verify = useOps((s) => s.verifyCall);
  const backup = useOps((s) => s.requestBackup);
  const reassign = useOps((s) => s.reassignHospital);
  const selectIncident = useOps((s) => s.selectIncident);

  const filteredIncidentIds = new Set(
    incidents
      .filter((i) => region === "All" || i.region === region)
      .map((i) => i.id),
  );
  const visibleCalls = calls.filter((c) => filteredIncidentIds.has(c.incidentId));
  const visibleUnits = units.filter(
    (u) => region === "All" || u.region === region,
  );
  const queued = visibleCalls.filter((c) => !c.verified).length;
  const active = [...filteredIncidentIds].filter(
    (id) => incidents.find((i) => i.id === id)?.status !== "resolved",
  ).length;

  const logs = incidents
    .filter((i) => region === "All" || i.region === region)
    .flatMap((i) => i.log.map((l) => ({ t: l, id: i.id })))
    .slice(0, 40);

  return (
    <div>
      <PageHead
        title="Dispatcher Console"
        sub="Unified queue for voice, USSD/SMS and app-based reports from all four regions of Uganda."
      />
      <Card className="mb-3.5 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] uppercase tracking-[0.08em] text-mute">
            Filter by region
          </span>
          <NativeSelect
            className="w-auto min-w-[200px]"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="All">All Uganda — every region</option>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </NativeSelect>
          <span className="text-[11.5px] text-mute">
            {region === "All"
              ? `Showing all ${units.length} units and ${incidents.length} incidents nationwide.`
              : `Showing ${visibleUnits.length} unit(s) and ${filteredIncidentIds.size} incident(s) in the ${region} region.`}
          </span>
        </div>
      </Card>
      <LogCallForm />
      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Calls in queue" value={queued} tone="amber" />
        <StatCard label="Active incidents" value={active} tone="alert" />
        <StatCard
          label="Units en route"
          value={visibleUnits.filter((u) => u.status === "enroute").length}
        />
        <StatCard
          label="Units available"
          value={visibleUnits.filter((u) => u.status === "available").length}
          tone="ok"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardTitle>
            Inbound queue
            <span className="font-mono text-[10.5px] font-normal text-mute">
              voice · USSD · SMS · app
            </span>
          </CardTitle>
          {visibleCalls.length === 0 ? (
            <p className="text-[13px] text-mute">
              No calls in queue
              {region === "All" ? "" : " for the " + region + " region"}.
            </p>
          ) : (
            visibleCalls.map((c) => {
              const inc = incidents.find((i) => i.id === c.incidentId);
              if (!inc) return null;
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectIncident(inc.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") selectIncident(inc.id);
                  }}
                  className="relative mb-3 overflow-hidden rounded-lg bg-panel-2 p-3.5 pl-4 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.07)]"
                >
                  <span
                    className={
                      c.verified
                        ? "absolute inset-y-0 left-0 w-0.5 bg-ok"
                        : "absolute inset-y-0 left-0 w-0.5 bg-alert"
                    }
                  />
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] text-amber">
                      {c.channel.toUpperCase()} · {c.time} · {inc.region} Region
                    </span>
                    <div className="flex items-center gap-2">
                      <SlaClock reportedAt={inc.reportedAt} compact />
                      <Badge tone={c.verified ? "ok" : "mute"}>
                        {c.verified ? "verified" : "unverified"}
                      </Badge>
                    </div>
                  </div>
                  <div className="mb-1.5 text-[13px]">
                    <b>{inc.type}</b> — {inc.location}
                  </div>
                  <div className="mb-2 text-xs text-mute">{inc.desc}</div>
                  <div className="mb-2 text-xs">
                    Casualties reported: <b>{inc.casualties}</b> · Units assigned:{" "}
                    <b>{inc.assigned.length}</b> ·{" "}
                    <StatusBadge status={inc.status} />
                  </div>
                  {inc.hospitalLink && (
                    <div className="mb-2 text-xs">
                      Linked hospital: <b>{inc.hospitalLink.name}</b> ·{" "}
                      {inc.hospitalLink.dist} km · ETA {inc.hospitalLink.eta} min
                      · {inc.hospitalLink.traumaReserved} trauma bay(s) reserved
                    </div>
                  )}
                  <Field label="Swift-response hospital link">
                    <NativeSelect
                      value={inc.hospitalLink?.hospitalId || ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        reassign(inc.id, e.target.value);
                      }}
                    >
                      <option value="">— reassign linked hospital —</option>
                      {hospitals
                        .filter(
                          (h) =>
                            (h.country || "Uganda") === (inc.country || "Uganda"),
                        )
                        .map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name.replace(" Hospital", "")} · {h.traumaAvailable} bays
                          </option>
                        ))}
                    </NativeSelect>
                  </Field>
                  <div
                    className="flex flex-wrap gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!c.verified && (
                      <Button size="sm" onClick={() => { verify(c.id); toast.success("Dispatch verified"); }}>
                        Verify & confirm dispatch
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => backup(inc.id)}
                    >
                      Request additional ambulance
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </Card>
        <Card>
          <CardTitle>Auto-dispatch log</CardTitle>
          <div className="max-h-[360px] overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-[13px] text-mute">No dispatch activity yet.</p>
            ) : (
              logs.map((l, idx) => (
                <div
                  key={idx}
                  className="border-b border-dashed border-line py-1.5 font-mono text-[11.5px] text-mute"
                >
                  <b className="text-ink">{l.id}</b>{" "}
                  {l.t.replace(/^\[.*?\]\s*/, "")}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function CallCentreView() {
  const units = useOps((s) => s.units);
  const hospitals = useOps((s) => s.hospitals);
  const outbound = useOps((s) => s.outboundCalls);
  const callProvider = useOps((s) => s.callProvider);
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");

  const dir = [
    ...units.map((u) => ({
      key: "unit-" + u.id,
      name: `${u.agency} (${u.id})`,
      type: u.type,
      region: u.region,
      phone: u.phone || "+256 772 000 000",
      status: u.status,
    })),
    ...hospitals.map((h) => ({
      key: "hosp-" + h.id,
      name: h.name,
      type: "Hospital",
      region: h.region,
      phone: h.phone,
      status: h.traumaAvailable > 0 ? "available" : "busy",
    })),
  ].filter((p) => {
    if (filter !== "All" && p.region !== filter) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      p.name.toLowerCase().includes(s) ||
      p.phone.toLowerCase().includes(s) ||
      p.type.toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <PageHead
        title="National Dispatch Control Centre"
        sub="Direct outbound line from the main control centre to every EMS provider, police division and hospital registered countrywide."
      />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardTitle>
            Provider directory
            <span className="font-mono text-[10.5px] font-normal text-mute">
              {dir.length} providers
            </span>
          </CardTitle>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <NativeSelect
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="All">
                All regions — Uganda + East African Community
              </option>
              <optgroup label="Uganda">
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </optgroup>
              <optgroup label="East African Community">
                <option>Kenya</option>
                <option>Tanzania</option>
                <option>Rwanda</option>
                <option>Burundi</option>
                <option>South Sudan</option>
                <option>DR Congo</option>
              </optgroup>
            </NativeSelect>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search provider, phone, type"
            />
          </div>
          <DataTable
            headers={[
              "Provider",
              "Type",
              "Region / Country",
              "Phone",
              "Status",
              "",
            ]}
          >
            {dir.map((p) => (
              <tr key={p.key}>
                <Td>{p.name}</Td>
                <Td>{p.type}</Td>
                <Td className="text-mute">{p.region}</Td>
                <Td mono>{p.phone}</Td>
                <Td>
                  <UnitBadge status={p.status} />
                </Td>
                <Td>
                  <Button size="sm" onClick={() => callProvider(p.key)}>
                    Call
                  </Button>
                </Td>
              </tr>
            ))}
          </DataTable>
        </Card>
        <Card>
          <CardTitle>
            Outbound call log
            <span className="font-mono text-[10.5px] font-normal text-mute">
              main control centre line
            </span>
          </CardTitle>
          <div className="max-h-[420px] overflow-y-auto">
            {outbound.length === 0 ? (
              <p className="text-[13px] text-mute">
                No outbound calls logged yet.
              </p>
            ) : (
              outbound.map((c) => (
                <div
                  key={c.id}
                  className="mb-2.5 rounded-lg bg-panel-2 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.07)]"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[10.5px] text-amber">
                      MAIN CONTROL CENTRE → {c.name}
                    </span>
                    <Badge tone="ok">{c.status}</Badge>
                  </div>
                  <div className="text-xs text-mute">
                    {c.phone} · {c.region} · initiated {c.time}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function DispatchMapView() {
  const region = useOps((s) => s.regionFilter);
  const hospitals = useOps((s) => s.hospitals);
  const units = useOps((s) => s.units);
  const incidents = useOps((s) => s.incidents);
  const selectedId = useOps((s) => s.selectedIncidentId);
  const selectIncident = useOps((s) => s.selectIncident);
  const applyFilter = region !== "All";
  const hospList = hospitals.filter(
    (h) =>
      (h.country || "Uganda") === "Uganda" &&
      (!applyFilter || h.region === region),
  );
  const unitList = units.filter(
    (u) =>
      (u.country || "Uganda") === "Uganda" &&
      (!applyFilter || u.region === region),
  );
  const incList = incidents.filter(
    (i) => i.status !== "resolved" && (!applyFilter || i.region === region),
  );

  return (
    <div>
      <PageHead
        title="Live National Unit Map"
        sub="Real-time position of ambulances, police units and hospitals across all four regions of Uganda. Units roll toward assigned incidents. Tap a red marker to open the case."
      />
      <Card>
        <OpsMap
          hospitals={hospList}
          units={unitList}
          incidents={incList}
          selectedId={selectedId}
          onSelect={selectIncident}
        />
      </Card>
    </div>
  );
}
