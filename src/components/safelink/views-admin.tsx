import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { COUNTRIES, EAC_COUNTRIES } from "@/lib/safelink/constants";
import { LOCATIONS } from "@/lib/safelink/seed";
import { useOps } from "@/lib/safelink/store";
import type { UnitType } from "@/lib/safelink/types";
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

export function AdminOverview() {
  const incidents = useOps((s) => s.incidents);
  const units = useOps((s) => s.units);
  const hospitals = useOps((s) => s.hospitals);
  const selectedId = useOps((s) => s.selectedIncidentId);
  const selectIncident = useOps((s) => s.selectIncident);
  const active = incidents.filter((i) => i.status !== "resolved").length;
  const avail = units.filter((u) => u.status === "available").length;
  const enroute = units.filter((u) => u.status === "enroute").length;
  const trend = incidents
    .slice(0, 8)
    .slice()
    .reverse()
    .map((inc, i) => ({
      i: i + 1,
      min: inc.assigned[0]?.eta ?? 8,
    }));

  const ugHosp = hospitals.filter((h) => (h.country || "Uganda") === "Uganda");
  const ugUnits = units.filter((u) => (u.country || "Uganda") === "Uganda");
  const live = incidents.filter((i) => i.status !== "resolved");

  return (
    <div>
      <PageHead
        title="National Overview"
        sub="Live status across all connected agencies and jurisdictions."
      />
      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Active incidents" value={active} tone="alert" />
        <StatCard label="Units available" value={avail} tone="ok" />
        <StatCard label="Units en route" value={enroute} tone="amber" />
        <StatCard label="Total registered units" value={units.length} />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardTitle>
            Live incident map
            <span className="font-mono text-[10.5px] font-normal text-mute">
              Uganda · OpenStreetMap
            </span>
          </CardTitle>
          <OpsMap
            hospitals={ugHosp}
            units={ugUnits}
            incidents={live}
            selectedId={selectedId}
            onSelect={selectIncident}
          />
        </Card>
        <Card>
          <CardTitle>
            Response time trend
            <span className="font-mono text-[10.5px] font-normal text-mute">
              last 8 incidents
            </span>
          </CardTitle>
          <div className="h-[160px]">
            {trend.length === 0 ? (
              <p className="p-4 text-sm text-mute">No incidents yet this session.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                  <XAxis dataKey="i" hide />
                  <YAxis hide domain={[0, 16]} />
                  <Tooltip
                    contentStyle={{
                      background: "#132436",
                      border: "1px solid #22374C",
                      fontSize: 12,
                    }}
                    labelFormatter={() => "avg dispatch-to-arrival (min)"}
                  />
                  <Line
                    type="monotone"
                    dataKey="min"
                    stroke="#F2A900"
                    strokeWidth={2.5}
                    dot={{ fill: "#E63946", r: 3.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
      <Card>
        <CardTitle>
          All incidents
          <span className="font-mono text-[10.5px] font-normal text-mute">
            {incidents.length} total
          </span>
        </CardTitle>
        <DataTable
          headers={[
            "ID",
            "Type",
            "Location",
            "Casualties",
            "Status",
            "Assigned",
            "Hospital",
            "Reported",
            "Dispatch",
          ]}
        >
          {incidents.length === 0 ? (
            <EmptyRow cols={9}>No incidents yet this session.</EmptyRow>
          ) : (
            incidents.map((i) => (
              <tr
                key={i.id}
                className="cursor-pointer"
                onClick={() => selectIncident(i.id)}
              >
                <Td mono>{i.id}</Td>
                <Td>{i.type}</Td>
                <Td>{i.location}</Td>
                <Td>{i.casualties}</Td>
                <Td>
                  <StatusBadge status={i.status} />
                </Td>
                <Td mono>
                  {i.assigned.map((a) => a.unitId).join(", ") || "—"}
                </Td>
                <Td className="text-[11.5px]">
                  {i.hospitalLink
                    ? i.hospitalLink.name
                        .replace(" Hospital", "")
                        .replace(" Referral", "")
                    : "—"}
                </Td>
                <Td mono>{i.time}</Td>
                <Td>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 whitespace-nowrap px-2 text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      selectIncident(i.id);
                    }}
                  >
                    {i.assigned.length > 0 ? "Manage dispatch" : "Assign dispatch"}
                  </Button>
                </Td>
              </tr>
            ))
          )}
        </DataTable>
      </Card>
    </div>
  );
}

export function FleetView() {
  const units = useOps((s) => s.units);
  const add = useOps((s) => s.addAmbulanceService);
  const [filter, setFilter] = useState("All");
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rows = units.filter((u) => filter === "All" || u.country === filter);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const msg = await add({
      agency: String(fd.get("agency") || ""),
      zoneName: String(fd.get("zone") || ""),
      phone: String(fd.get("phone") || ""),
      type: String(fd.get("type") || "Ambulance") as UnitType,
      capacity: parseInt(String(fd.get("capacity") || "4"), 10),
      count: parseInt(String(fd.get("units") || "1"), 10),
    });
    if (msg?.startsWith("Enter")) {
      setErr(msg);
      setOk(null);
    } else {
      setOk(msg);
      setErr(null);
      toast.success(msg);
      e.currentTarget.reset();
    }
  }

  return (
    <div>
      <PageHead
        title="Ambulance Services & Fleet Registry"
        sub="Onboard new ambulance services or police units — they join the live dispatch pool immediately."
      />
      <Card className="mb-4">
        <CardTitle>
          Register ambulance service
          <span className="font-mono text-[10.5px] font-normal text-mute">
            adds unit(s) directly to auto-dispatch
          </span>
        </CardTitle>
        {err && <Alert tone="crit">{err}</Alert>}
        {ok && <Alert tone="ok">{ok}</Alert>}
        <form onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Field label="Service / agency name">
                <Input
                  name="agency"
                  placeholder="e.g. Nakasero Hospital Ambulance Service"
                />
              </Field>
              <Field label="Base zone (nationwide)">
                <NativeSelect name="zone" defaultValue={LOCATIONS[1].name}>
                  {LOCATIONS.map((l) => (
                    <option key={l.name}>{l.name}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Dispatch contact phone">
                <Input name="phone" placeholder="+256 7XX XXX XXX" />
              </Field>
            </div>
            <div>
              <Field label="Unit type">
                <NativeSelect name="type" defaultValue="Ambulance">
                  <option>Ambulance</option>
                  <option>Police</option>
                  <option>Fire</option>
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Patient capacity / unit">
                  <Input name="capacity" defaultValue="4" />
                </Field>
                <Field label="Number of units">
                  <Input name="units" defaultValue="1" />
                </Field>
              </div>
            </div>
          </div>
          <Button type="submit">Onboard service</Button>
        </form>
      </Card>
      <Card>
        <CardTitle>
          Registered units
          <span className="font-mono text-[10.5px] font-normal text-mute">
            {rows.length} of {units.length} registered
          </span>
        </CardTitle>
        <div className="mb-3">
          <NativeSelect
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="All">
              All coverage — Uganda + East African Community
            </option>
            <optgroup label="Uganda">
              <option value="Uganda">Uganda (nationwide)</option>
            </optgroup>
            <optgroup label="East African Community">
              {EAC_COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </optgroup>
          </NativeSelect>
        </div>
        <DataTable
          headers={[
            "Unit ID",
            "Type",
            "Agency",
            "Country",
            "Region / Zone",
            "Status",
            "Capacity",
          ]}
        >
          {rows.map((u) => (
            <tr key={u.id}>
              <Td mono>{u.id}</Td>
              <Td>{u.type}</Td>
              <Td>{u.agency}</Td>
              <Td className="text-amber">{u.country}</Td>
              <Td className="text-mute">
                {u.region} · {u.zone}
              </Td>
              <Td>
                <UnitBadge status={u.status} />
              </Td>
              <Td>{u.type === "Ambulance" ? u.capacity + " patients" : "—"}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}

export function HospitalsView() {
  const hospitals = useOps((s) => s.hospitals);
  const add = useOps((s) => s.addHospital);
  const [filter, setFilter] = useState("All");
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rows = hospitals.filter(
    (h) => filter === "All" || (h.country || "Uganda") === filter,
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const msg = await add({
      name: String(fd.get("name") || ""),
      zoneName: String(fd.get("zone") || ""),
      beds: parseInt(String(fd.get("beds") || "30"), 10),
      trauma: parseInt(String(fd.get("trauma") || "4"), 10),
      phone: String(fd.get("phone") || ""),
    });
    if (msg?.startsWith("Enter")) {
      setErr(msg);
      setOk(null);
    } else {
      setOk(msg);
      setErr(null);
      toast.success(msg);
      e.currentTarget.reset();
    }
  }

  return (
    <div>
      <PageHead
        title="Hospital Network"
        sub="Partner hospitals eligible for direct swift-response linking with dispatched EMS units."
      />
      <Card className="mb-4">
        <CardTitle>Add partner hospital</CardTitle>
        {err && <Alert tone="crit">{err}</Alert>}
        {ok && <Alert tone="ok">{ok}</Alert>}
        <form onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Field label="Hospital name">
                <Input name="name" placeholder="e.g. Nsambya Hospital" />
              </Field>
              <Field label="Zone">
                <NativeSelect name="zone" defaultValue={LOCATIONS[1].name}>
                  {LOCATIONS.map((l) => (
                    <option key={l.name}>{l.name}</option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Total beds">
                  <Input name="beds" defaultValue="30" />
                </Field>
                <Field label="Trauma bays">
                  <Input name="trauma" defaultValue="4" />
                </Field>
              </div>
              <Field label="Contact phone">
                <Input name="phone" placeholder="+256 ..." />
              </Field>
            </div>
          </div>
          <Button type="submit">Add to network</Button>
        </form>
      </Card>
      <Card>
        <CardTitle>
          Partner hospitals
          <span className="font-mono text-[10.5px] font-normal text-mute">
            {rows.length} of {hospitals.length} registered
          </span>
        </CardTitle>
        <div className="mb-3">
          <NativeSelect
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="All">
              All coverage — Uganda + East African Community
            </option>
            <optgroup label="Uganda">
              <option value="Uganda">Uganda (nationwide)</option>
            </optgroup>
            <optgroup label="East African Community">
              {COUNTRIES.filter((c) => c !== "Uganda").map((c) => (
                <option key={c}>{c}</option>
              ))}
            </optgroup>
          </NativeSelect>
        </div>
        <DataTable
          headers={[
            "Hospital",
            "Tier",
            "Country",
            "Zone",
            "Beds available",
            "Trauma bays available",
            "Phone",
          ]}
        >
          {rows.map((h) => (
            <tr key={h.id}>
              <Td>{h.name}</Td>
              <Td className="text-mute">{h.tier}</Td>
              <Td className="text-amber">{h.country}</Td>
              <Td className="text-mute">{h.zone}</Td>
              <Td>
                {h.bedsAvailable}/{h.bedsTotal}
              </Td>
              <Td>
                {h.traumaAvailable}/{h.traumaTotal}
              </Td>
              <Td mono>{h.phone}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}

export function AdminAccountsView() {
  const [accounts, setAccounts] = useState<{ username: string; displayName: string; role: string; recoveryEmail: string; active: boolean }[]>([]);
  const saveOperator = useOps((s) => s.saveOperator);
  const issueResetToken = useOps((s) => s.issueResetToken);
  const listOperators = useOps((s) => s.listOperators);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<{ username: string; token: string; expiresAt: string } | null>(null);

  async function refreshAccounts() { setAccounts(await listOperators()); }
  useEffect(() => { void listOperators().then(setAccounts); }, [listOperators]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const result = await saveOperator({
      username: String(form.get("username") || ""), displayName: String(form.get("displayName") || ""),
      role: String(form.get("role") || "ems") as never, password: String(form.get("password") || "") || undefined,
      recoveryEmail: String(form.get("recoveryEmail") || ""), active: form.get("active") === "on",
    });
    if (result) { setError(result); setMessage(null); return; }
    setError(null); setMessage("Staff account saved. Changes are live immediately."); formElement.reset(); await refreshAccounts();
  }

  async function generateToken(username: string) {
    const result = await issueResetToken(username);
    if (typeof result === "string") { setError(result); setResetToken(null); return; }
    setError(null); setResetToken({ username, ...result });
  }

  return (
    <div>
      <PageHead title="Staff accounts" sub="Create access for dispatch, EMS and EMT teams. Updates apply immediately." />
      <Card className="mb-4">
        <CardTitle>Create or update credentials</CardTitle>
        {error && <Alert tone="crit">{error}</Alert>}
        {message && <Alert tone="ok">{message}</Alert>}
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
          <Field label="Username"><Input name="username" required placeholder="responder.namutebi" /></Field>
          <Field label="Display name"><Input name="displayName" required placeholder="Namutebi Response Team" /></Field>
          <Field label="Recovery email"><Input name="recoveryEmail" type="email" required placeholder="name@example.org" /></Field>
          <Field label="Console role"><NativeSelect name="role" defaultValue="ems"><option value="ems">EMS responder</option><option value="emt">EMT</option><option value="dispatcher">Dispatcher</option><option value="admin">Administrator</option></NativeSelect></Field>
          <Field label="New password"><Input name="password" type="password" minLength={8} placeholder="Required for new accounts" /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-mute"><input name="active" type="checkbox" defaultChecked /> Account active</label>
          <div className="md:col-span-2"><Button type="submit">Save staff account</Button></div>
        </form>
      </Card>
      {resetToken && <Alert tone="ok"><div className="font-semibold">One-time reset token for {resetToken.username}</div><div className="mt-1 break-all font-mono text-xs">{resetToken.token}</div><div className="mt-1 text-xs">Copy and send it manually. Expires {new Date(resetToken.expiresAt).toLocaleString()}. It is shown only once; no email was sent.</div></Alert>}
      <Card className="mt-4">
        <CardTitle>Registered staff <span className="font-mono text-[10.5px] font-normal text-mute">{accounts.length} accounts</span></CardTitle>
        <DataTable headers={["Username", "Recovery email", "Role", "Status", "Reset"]}>
          {accounts.map((account) => <tr key={account.username}><Td mono>{account.username}</Td><Td>{account.recoveryEmail}</Td><Td className="text-amber">{account.role}</Td><Td>{account.active ? "Active" : "Inactive"}</Td><Td><Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => void generateToken(account.username)}>Generate token</Button></Td></tr>)}
        </DataTable>
      </Card>
    </div>
  );
}

export function NationalDirectoryView() {
  const units = useOps((s) => s.units).filter((u) => u.type === "Ambulance");
  const hospitals = useOps((s) => s.hospitals);
  const [query, setQuery] = useState("");
  const [facilityType, setFacilityType] = useState("all");
  const [region, setRegion] = useState("all");
  const normalized = query.trim().toLowerCase();
  const facilityTypes = Array.from(new Set(hospitals.map((hospital) => hospital.facilityType ?? "Hospital"))).sort();
  const regions = Array.from(new Set(hospitals.map((hospital) => hospital.region))).sort();
  const filteredHospitals = hospitals.filter((hospital) =>
    (facilityType === "all" || (hospital.facilityType ?? "Hospital") === facilityType) &&
    (region === "all" || hospital.region === region) &&
    [hospital.name, hospital.facilityType ?? "Hospital", hospital.region, hospital.zone, hospital.district ?? "", hospital.subcounty ?? "", hospital.phone].some((value) => value.toLowerCase().includes(normalized)),
  );
  const filteredUnits = units.filter((u) => [u.agency, u.region, u.zone, u.phone, u.id].some((value) => value.toLowerCase().includes(normalized)));
  const contacts = [
    { name: "Uganda Ministry of Health", phone: "0800-100-066", area: "National", source: "Official public contact; verify before operational use" },
    { name: "Uganda Police emergency", phone: "999", area: "National", source: "Public emergency number; verify before operational use" },
    { name: "National Health Facility Registry", phone: "", area: "National", source: "Official facility registry: nhfr.health.go.ug" },
    { name: "Mulago National Referral Hospital — Medical Emergency", phone: "+256 414 675065", area: "Kampala", source: "Public hospital listing; verify before operational use" },
    { name: "Mulago National Referral Hospital — Acute Care Unit", phone: "+256 414 675066", area: "Kampala", source: "Public hospital listing; verify before operational use" },
    { name: "Jinja Regional Referral Hospital — Accident & Emergency", phone: "+256 414 674584", area: "Jinja", source: "Public hospital listing; verify before operational use" },
    { name: "Jinja Regional Referral Hospital — Ambulance", phone: "+256 414 674585", area: "Jinja", source: "Public hospital listing; verify before operational use" },
    { name: "Case Medical Centre", phone: "+256 414 250362", area: "Kampala", source: "Public provider listing; verify before operational use" },
    { name: "International Medical Group", phone: "+256 312 200400", area: "Uganda", source: "Public provider listing; verify before operational use" },
    { name: "City Ambulance", phone: "0800-111044", area: "Uganda", source: "Public provider listing; verify before operational use" },
    { name: "St John Ambulance Uganda", phone: "+256 414 230671", area: "Kampala", source: "Public provider listing; verify before operational use" },
  ];
  return (
    <div>
      <PageHead title="National directory" sub="Hospitals, registered ambulance units, districts, and emergency contacts. Verify community-listed numbers before dispatch." />
      <Card className="mb-4">
        <CardTitle>Google Maps directory sources</CardTitle>
        <p className="mb-3 text-sm text-mute">Use these public Google Maps views to cross-check facility names, locations, and contact details before adding or dispatching a record.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["Hospitals in Uganda", "https://www.google.com/maps/search/hospitals+in+Uganda"],
            ["Health centres in Uganda", "https://www.google.com/maps/search/health+centres+in+Uganda"],
            ["Uganda map overview", "https://www.google.com/maps/@1.3733,32.2903,7z"],
          ].map(([label, href]) => (
            <Button key={href} type="button" variant="secondary" onClick={() => window.open(href, "_blank", "noopener,noreferrer")}>
              {label}
            </Button>
          ))}
        </div>
      </Card>
      <Card className="mb-4">
        <CardTitle>National emergency contacts</CardTitle>
        <DataTable headers={["Organisation", "Contact", "Coverage", "Source status"]}>
          {contacts.map((contact) => <tr key={contact.name}><Td>{contact.name}</Td><Td mono className="text-amber">{contact.phone}</Td><Td>{contact.area}</Td><Td className="text-mute">{contact.source}</Td></tr>)}
        </DataTable>
      </Card>
      <Card className="mb-4">
        <CardTitle>Ambulance units <span className="font-mono text-[10.5px] font-normal text-mute">{filteredUnits.length} registered</span></CardTitle>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ambulance, agency, district, station, or contact" className="mb-3" />
        <DataTable headers={["Unit", "Agency / hospital", "District / station", "Contact", "Availability"]}>
          {filteredUnits.length === 0 ? <EmptyRow cols={5}>No ambulance records match this search.</EmptyRow> : filteredUnits.map((unit) => <tr key={unit.id}><Td mono>{unit.id}</Td><Td>{unit.agency}</Td><Td>{unit.region} · {unit.zone}</Td><Td mono>{unit.phone || "Not published"}</Td><Td><StatusBadge status={unit.status} /></Td></tr>)}
        </DataTable>
      </Card>
      <Card>
        <CardTitle>Uganda health facilities <span className="font-mono text-[10.5px] font-normal text-mute">{filteredHospitals.length} of {hospitals.length} records</span></CardTitle>
        <div className="mb-3 grid gap-2 md:grid-cols-[1fr_180px_180px]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search facility, district, subcounty, or contact" />
          <NativeSelect value={facilityType} onChange={(event) => setFacilityType(event.target.value)}><option value="all">All facility types</option>{facilityTypes.map((type) => <option key={type} value={type}>{type}</option>)}</NativeSelect>
          <NativeSelect value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">All regions</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}</NativeSelect>
        </div>
        <DataTable headers={["Facility", "Type / ownership", "District / region", "Contact", "Source"]}>
          {filteredHospitals.length === 0 ? <EmptyRow cols={5}>No facility records match these filters. Import the official National Health Facility Registry to populate the directory.</EmptyRow> : filteredHospitals.map((hospital) => <tr key={hospital.id}><Td><div>{hospital.name}</div><div className="font-mono text-[10px] text-mute">{hospital.subcounty || "Subcounty not recorded"}</div></Td><Td><div>{hospital.facilityType ?? "Hospital"}</div><div className="text-xs text-mute">{hospital.ownership}</div></Td><Td>{hospital.district || hospital.zone} · {hospital.region}</Td><Td mono>{hospital.phone || "Not published"}</Td><Td><span className={hospital.verificationStatus === "official" ? "text-green-700" : "text-amber"}>{hospital.verificationStatus === "official" ? "Official registry" : "Needs verification"}</span></Td></tr>)}
        </DataTable>
      </Card>
    </div>
  );
}

export function AnalyticsView() {
  const incidents = useOps((s) => s.incidents);
  const resolved = incidents.filter((i) => i.status === "resolved").length;
  const totalCasualties = incidents.reduce((s, i) => s + i.casualties, 0);
  const avgUnits = incidents.length
    ? (
        incidents.reduce((s, i) => s + i.assigned.length, 0) / incidents.length
      ).toFixed(1)
    : "0.0";
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    incidents.forEach((i) => {
      map[i.type] = (map[i.type] || 0) + 1;
    });
    return Object.entries(map).map(([type, count]) => ({ type, count }));
  }, [incidents]);

  return (
    <div>
      <PageHead
        title="Analytics"
        sub="Aggregate KPIs used for scale-up decisions."
      />
      <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Incidents logged (session)" value={incidents.length} />
        <StatCard label="Resolved" value={resolved} tone="ok" />
        <StatCard label="Casualties recorded" value={totalCasualties} tone="alert" />
        <StatCard label="Avg. units per incident" value={avgUnits} tone="amber" />
      </div>
      <Card>
        <CardTitle>Incidents by type</CardTitle>
        <div className="h-[200px]">
          {byType.length === 0 ? (
            <p className="p-4 text-sm text-mute">
              No incident data yet this session.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="type"
                  tick={{ fill: "#8FA3B5", fontSize: 10 }}
                  interval={0}
                />
                <YAxis allowDecimals={false} tick={{ fill: "#8FA3B5", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "#132436",
                    border: "1px solid #22374C",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="#E63946" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
