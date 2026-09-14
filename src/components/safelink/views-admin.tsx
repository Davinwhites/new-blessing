import { useMemo, useState, type FormEvent } from "react";
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
          ]}
        >
          {incidents.length === 0 ? (
            <EmptyRow cols={8}>No incidents yet this session.</EmptyRow>
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
