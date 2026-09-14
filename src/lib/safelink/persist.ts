import { createHash } from "node:crypto";
import { getSql, type Sql } from "@/lib/db";
import { DEFAULT_USER, OPERATOR_PASSWORD, ROLE_NAV } from "./constants";
import {
  assignUnit,
  autoDispatch,
  buildIncident,
  linkHospital,
  matchLocation,
  nearestAvailable,
  releaseHospital,
  moveUnitsTowardIncidents,
} from "./engine";
import { haversineKm, nowStr } from "./geo";
import { INITIAL_EMTS, INITIAL_HOSPITALS, INITIAL_UNITS, LOCATIONS } from "./seed";
import { SIM_SCENARIOS } from "./scenarios";
import type {
  CallRecord,
  Emt,
  Hospital,
  Incident,
  OpsSnapshot,
  OutboundCall,
  ReportInput,
  Role,
  SmsMessage,
  Unit,
  UnitType,
} from "./types";

type Mutable = OpsSnapshot;

const OPERATORS: { username: string; role: Role }[] = [
  { username: DEFAULT_USER.admin, role: "admin" },
  { username: DEFAULT_USER.dispatcher, role: "dispatcher" },
  { username: DEFAULT_USER.ems, role: "ems" },
  { username: DEFAULT_USER.emt, role: "emt" },
  { username: DEFAULT_USER.public, role: "public" },
];

function hashPassword(username: string, password: string): string {
  return createHash("sha256")
    .update(`safelink|${username}|${password}`)
    .digest("hex");
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function metaGet(sql: Sql, key: string, fallback: string): Promise<string> {
  const rows = await sql.query<{ value: string }>(
    "select value from sl_meta where key = $1",
    [key],
  );
  return rows[0]?.value ?? fallback;
}

async function metaSet(sql: Sql, key: string, value: string): Promise<void> {
  await sql.query(
    `insert into sl_meta (key, value) values ($1, $2)
     on conflict (key) do update set value = excluded.value`,
    [key, value],
  );
}

export async function ensureSeeded(): Promise<void> {
  const sql = await getSql();
  const [{ n }] = await sql.query<{ n: number }>(
    "select count(*)::int as n from sl_units",
  );
  if (n > 0) return;

  for (const op of OPERATORS) {
    await sql.query(
      `insert into sl_operators (username, display_name, role, password_hash)
       values ($1, $2, $3, $4)
       on conflict (username) do nothing`,
      [op.username, op.username, op.role, hashPassword(op.username, OPERATOR_PASSWORD)],
    );
  }

  const units: Unit[] = INITIAL_UNITS.map((u) => ({ ...u }));
  const hospitals: Hospital[] = INITIAL_HOSPITALS.map((h) => ({ ...h }));
  const incidents: Incident[] = [];
  const calls: CallRecord[] = [];
  const sms: SmsMessage[] = [];
  let incidentSeq = 1000;
  let smsSeq = 0;

  for (const sc of SIM_SCENARIOS.slice(0, 5)) {
    incidentSeq += 1;
    const loc = matchLocation(sc.locationHint);
    const source =
      sc.channel === "Voice"
        ? "Voice 919"
        : sc.channel === "USSD"
          ? "USSD *919#"
          : sc.channel === "WhatsApp"
            ? "WhatsApp +256 919 000 001"
            : "Public app report";
    const inc = buildIncident(
      {
        type: sc.type,
        location: loc.name,
        region: loc.region,
        country: "Uganda",
        lat: loc.lat,
        lng: loc.lng,
        casualties: sc.casualties,
        desc: sc.desc,
        source,
        reporter: sc.reporter,
        channel: sc.channel,
        from: sc.reporter,
      },
      "INC-" + incidentSeq,
    );
    autoDispatch(inc, units, hospitals);
    incidents.push(inc);
    calls.push({
      id: "CALL-" + inc.id,
      channel: sc.channel,
      from: sc.reporter,
      incidentId: inc.id,
      verified: sc.channel === "Voice",
      time: nowStr(),
    });
    smsSeq += 1;
    const etaMsg = inc.assigned.length
      ? `${inc.assigned.length} unit(s) dispatched, nearest ETA ${inc.assigned[0].eta} min.`
      : "Searching for the nearest available unit.";
    sms.push({
      id: "SMS-" + smsSeq,
      phone: "+256 772 000 000",
      text: `SafeLink Uganda: Report received. Ref ${inc.id}. ${etaMsg}`,
      time: nowStr(),
    });
  }

  for (const u of units) {
    await sql.query(
      `insert into sl_units
        (id, type, agency, country, region, zone, lat, lng, status, capacity, phone, assigned_incident)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (id) do nothing`,
      [
        u.id,
        u.type,
        u.agency,
        u.country,
        u.region,
        u.zone,
        u.lat,
        u.lng,
        u.status,
        u.capacity,
        u.phone,
        u.assignedIncident,
      ],
    );
  }

  for (const h of hospitals) {
    await sql.query(
      `insert into sl_hospitals
        (id, name, country, tier, ownership, region, zone, lat, lng,
         beds_total, beds_available, trauma_total, trauma_available, phone)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (id) do nothing`,
      [
        h.id,
        h.name,
        h.country,
        h.tier,
        h.ownership,
        h.region,
        h.zone,
        h.lat,
        h.lng,
        h.bedsTotal,
        h.bedsAvailable,
        h.traumaTotal,
        h.traumaAvailable,
        h.phone,
      ],
    );
  }

  for (const e of INITIAL_EMTS) {
    await sql.query(
      `insert into sl_emts
        (id, name, level, cert_body, agency, region, phone, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (id) do nothing`,
      [e.id, e.name, e.level, e.certBody, e.agency, e.region, e.phone, e.status],
    );
  }

  for (const inc of incidents) await saveIncident(sql, inc);
  for (const c of calls) await saveCall(sql, c);
  for (const m of sms) await saveSms(sql, m);

  await metaSet(sql, "incident_seq", String(incidentSeq));
  await metaSet(sql, "unit_seq", "40");
  await metaSet(sql, "hospital_seq", "27");
  await metaSet(sql, "emt_seq", String(INITIAL_EMTS.length));
  await metaSet(sql, "sms_seq", String(smsSeq));
  await metaSet(sql, "outbound_seq", "0");
  await metaSet(sql, "last_tick", String(Date.now()));
}

async function loadMutable(): Promise<Mutable> {
  const sql = await getSql();
  const [units, hospitals, emts, incidents, calls, outbound, sms] = await Promise.all([
    sql.query<Record<string, unknown>>("select * from sl_units order by id"),
    sql.query<Record<string, unknown>>("select * from sl_hospitals order by name"),
    sql.query<Record<string, unknown>>("select * from sl_emts order by id"),
    sql.query<Record<string, unknown>>(
      "select * from sl_incidents order by reported_at desc",
    ),
    sql.query<Record<string, unknown>>(
      "select * from sl_calls order by created_at desc",
    ),
    sql.query<Record<string, unknown>>(
      "select * from sl_outbound order by created_at desc",
    ),
    sql.query<Record<string, unknown>>(
      "select * from sl_sms order by created_at desc",
    ),
  ]);

  return {
    units: units.map(rowToUnit),
    hospitals: hospitals.map(rowToHospital),
    emts: emts.map(rowToEmt),
    incidents: incidents.map(rowToIncident),
    calls: calls.map(rowToCall),
    outboundCalls: outbound.map(rowToOutbound),
    smsLog: sms.map(rowToSms),
    incidentSeq: Number(await metaGet(sql, "incident_seq", "1000")),
    unitSeq: Number(await metaGet(sql, "unit_seq", "40")),
    hospitalSeq: Number(await metaGet(sql, "hospital_seq", "27")),
    emtSeq: Number(await metaGet(sql, "emt_seq", "8")),
    smsSeq: Number(await metaGet(sql, "sms_seq", "0")),
    outboundSeq: Number(await metaGet(sql, "outbound_seq", "0")),
  };
}

function rowToUnit(r: Record<string, unknown>): Unit {
  return {
    id: String(r.id),
    type: r.type as Unit["type"],
    agency: String(r.agency),
    country: String(r.country),
    region: String(r.region),
    zone: String(r.zone),
    lat: asNumber(r.lat),
    lng: asNumber(r.lng),
    status: r.status as Unit["status"],
    capacity: asNumber(r.capacity),
    phone: String(r.phone),
    assignedIncident: r.assigned_incident ? String(r.assigned_incident) : null,
  };
}

function rowToHospital(r: Record<string, unknown>): Hospital {
  return {
    id: String(r.id),
    name: String(r.name),
    country: String(r.country),
    tier: String(r.tier),
    ownership: String(r.ownership),
    region: String(r.region),
    zone: String(r.zone),
    lat: asNumber(r.lat),
    lng: asNumber(r.lng),
    bedsTotal: asNumber(r.beds_total),
    bedsAvailable: asNumber(r.beds_available),
    traumaTotal: asNumber(r.trauma_total),
    traumaAvailable: asNumber(r.trauma_available),
    phone: String(r.phone),
  };
}

function rowToEmt(r: Record<string, unknown>): Emt {
  return {
    id: String(r.id),
    name: String(r.name),
    level: String(r.level),
    certBody: String(r.cert_body),
    agency: String(r.agency),
    region: String(r.region),
    phone: String(r.phone),
    status: r.status === "Off Duty" ? "Off Duty" : "On Duty",
  };
}

function rowToIncident(r: Record<string, unknown>): Incident {
  return {
    id: String(r.id),
    type: String(r.type),
    location: String(r.location),
    region: String(r.region),
    country: String(r.country),
    lat: asNumber(r.lat),
    lng: asNumber(r.lng),
    casualties: asNumber(r.casualties),
    desc: String(r.description),
    source: String(r.source),
    reporter: String(r.reporter),
    status: r.status as Incident["status"],
    assigned: parseJson(r.assigned, []),
    time: String(r.time_label),
    reportedAt: asNumber(r.reported_at),
    log: parseJson(r.log, []),
    hospitalLink: parseJson(r.hospital_link, null),
  };
}

function rowToCall(r: Record<string, unknown>): CallRecord {
  return {
    id: String(r.id),
    channel: r.channel as CallRecord["channel"],
    from: String(r.from_number),
    incidentId: String(r.incident_id),
    verified: Boolean(r.verified),
    time: String(r.time_label),
  };
}

function rowToOutbound(r: Record<string, unknown>): OutboundCall {
  return {
    id: String(r.id),
    name: String(r.name),
    phone: String(r.phone),
    region: String(r.region),
    status: "logged",
    time: String(r.time_label),
  };
}

function rowToSms(r: Record<string, unknown>): SmsMessage {
  return {
    id: String(r.id),
    phone: String(r.phone),
    text: String(r.body),
    time: String(r.time_label),
  };
}

async function saveUnit(sql: Sql, u: Unit): Promise<void> {
  await sql.query(
    `insert into sl_units
      (id, type, agency, country, region, zone, lat, lng, status, capacity, phone, assigned_incident)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (id) do update set
       type = excluded.type,
       agency = excluded.agency,
       country = excluded.country,
       region = excluded.region,
       zone = excluded.zone,
       lat = excluded.lat,
       lng = excluded.lng,
       status = excluded.status,
       capacity = excluded.capacity,
       phone = excluded.phone,
       assigned_incident = excluded.assigned_incident`,
    [
      u.id,
      u.type,
      u.agency,
      u.country,
      u.region,
      u.zone,
      u.lat,
      u.lng,
      u.status,
      u.capacity,
      u.phone,
      u.assignedIncident,
    ],
  );
}

async function saveHospital(sql: Sql, h: Hospital): Promise<void> {
  await sql.query(
    `insert into sl_hospitals
      (id, name, country, tier, ownership, region, zone, lat, lng,
       beds_total, beds_available, trauma_total, trauma_available, phone)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     on conflict (id) do update set
       name = excluded.name,
       country = excluded.country,
       tier = excluded.tier,
       ownership = excluded.ownership,
       region = excluded.region,
       zone = excluded.zone,
       lat = excluded.lat,
       lng = excluded.lng,
       beds_total = excluded.beds_total,
       beds_available = excluded.beds_available,
       trauma_total = excluded.trauma_total,
       trauma_available = excluded.trauma_available,
       phone = excluded.phone`,
    [
      h.id,
      h.name,
      h.country,
      h.tier,
      h.ownership,
      h.region,
      h.zone,
      h.lat,
      h.lng,
      h.bedsTotal,
      h.bedsAvailable,
      h.traumaTotal,
      h.traumaAvailable,
      h.phone,
    ],
  );
}

async function saveEmt(sql: Sql, e: Emt): Promise<void> {
  await sql.query(
    `insert into sl_emts
      (id, name, level, cert_body, agency, region, phone, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (id) do update set
       name = excluded.name,
       level = excluded.level,
       cert_body = excluded.cert_body,
       agency = excluded.agency,
       region = excluded.region,
       phone = excluded.phone,
       status = excluded.status`,
    [e.id, e.name, e.level, e.certBody, e.agency, e.region, e.phone, e.status],
  );
}

async function saveIncident(sql: Sql, i: Incident): Promise<void> {
  await sql.query(
    `insert into sl_incidents
      (id, type, location, region, country, lat, lng, casualties, description,
       source, reporter, status, time_label, reported_at, assigned, log, hospital_link)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb)
     on conflict (id) do update set
       type = excluded.type,
       location = excluded.location,
       region = excluded.region,
       country = excluded.country,
       lat = excluded.lat,
       lng = excluded.lng,
       casualties = excluded.casualties,
       description = excluded.description,
       source = excluded.source,
       reporter = excluded.reporter,
       status = excluded.status,
       time_label = excluded.time_label,
       reported_at = excluded.reported_at,
       assigned = excluded.assigned,
       log = excluded.log,
       hospital_link = excluded.hospital_link`,
    [
      i.id,
      i.type,
      i.location,
      i.region,
      i.country,
      i.lat,
      i.lng,
      i.casualties,
      i.desc,
      i.source,
      i.reporter,
      i.status,
      i.time,
      i.reportedAt,
      JSON.stringify(i.assigned),
      JSON.stringify(i.log),
      i.hospitalLink ? JSON.stringify(i.hospitalLink) : null,
    ],
  );
}

async function saveCall(sql: Sql, c: CallRecord): Promise<void> {
  await sql.query(
    `insert into sl_calls (id, channel, from_number, incident_id, verified, time_label)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (id) do update set
       verified = excluded.verified,
       time_label = excluded.time_label`,
    [c.id, c.channel, c.from, c.incidentId, c.verified, c.time],
  );
}

async function saveOutbound(sql: Sql, c: OutboundCall): Promise<void> {
  await sql.query(
    `insert into sl_outbound (id, name, phone, region, status, time_label)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (id) do update set status = excluded.status`,
    [c.id, c.name, c.phone, c.region, c.status, c.time],
  );
}

async function saveSms(sql: Sql, m: SmsMessage): Promise<void> {
  await sql.query(
    `insert into sl_sms (id, phone, body, time_label)
     values ($1,$2,$3,$4)
     on conflict (id) do nothing`,
    [m.id, m.phone, m.text, m.time],
  );
}

async function saveSeqs(sql: Sql, s: Mutable): Promise<void> {
  await metaSet(sql, "incident_seq", String(s.incidentSeq));
  await metaSet(sql, "unit_seq", String(s.unitSeq));
  await metaSet(sql, "hospital_seq", String(s.hospitalSeq));
  await metaSet(sql, "emt_seq", String(s.emtSeq));
  await metaSet(sql, "sms_seq", String(s.smsSeq));
  await metaSet(sql, "outbound_seq", String(s.outboundSeq));
}

async function saveMutable(s: Mutable, opts?: { units?: boolean; hospitals?: boolean; emts?: boolean; incidents?: boolean; calls?: boolean; outbound?: boolean; sms?: boolean; seqs?: boolean }): Promise<void> {
  const sql = await getSql();
  const all = !opts;
  if (all || opts?.units) {
    for (const u of s.units) await saveUnit(sql, u);
  }
  if (all || opts?.hospitals) {
    for (const h of s.hospitals) await saveHospital(sql, h);
  }
  if (all || opts?.emts) {
    for (const e of s.emts) await saveEmt(sql, e);
  }
  if (all || opts?.incidents) {
    for (const i of s.incidents) await saveIncident(sql, i);
  }
  if (all || opts?.calls) {
    for (const c of s.calls) await saveCall(sql, c);
  }
  if (all || opts?.outbound) {
    for (const c of s.outboundCalls) await saveOutbound(sql, c);
  }
  if (all || opts?.sms) {
    for (const m of s.smsLog) await saveSms(sql, m);
  }
  if (all || opts?.seqs) await saveSeqs(sql, s);
}

function snapshotOf(s: Mutable): OpsSnapshot {
  return {
    units: s.units,
    hospitals: s.hospitals,
    emts: s.emts,
    incidents: s.incidents,
    calls: s.calls,
    outboundCalls: s.outboundCalls,
    smsLog: s.smsLog,
    incidentSeq: s.incidentSeq,
    unitSeq: s.unitSeq,
    hospitalSeq: s.hospitalSeq,
    emtSeq: s.emtSeq,
    smsSeq: s.smsSeq,
    outboundSeq: s.outboundSeq,
  };
}

async function tickState(s: Mutable): Promise<void> {
  const sql = await getSql();
  const last = Number(await metaGet(sql, "last_tick", String(Date.now())));
  const now = Date.now();
  const steps = Math.min(10, Math.max(0, Math.floor((now - last) / 2200)));
  if (steps === 0) {
    await metaSet(sql, "last_tick", String(now));
    return;
  }
  for (let i = 0; i < steps; i++) {
    moveUnitsTowardIncidents(s.units, s.incidents);
  }
  await saveMutable(s, { units: true, incidents: true });
  await metaSet(sql, "last_tick", String(now));
}

export async function loadSnapshot(tick = true): Promise<OpsSnapshot> {
  await ensureSeeded();
  const s = await loadMutable();
  if (tick) await tickState(s);
  return snapshotOf(s);
}

export async function loginOperator(input: {
  username: string;
  password: string;
  role: Role;
}): Promise<{ ok: true; user: string; role: Role; viewId: string; snapshot: OpsSnapshot } | { ok: false; error: string }> {
  await ensureSeeded();
  const sql = await getSql();
  const rows = await sql.query<{ username: string; role: string; password_hash: string }>(
    "select username, role, password_hash from sl_operators where username = $1",
    [input.username.trim()],
  );
  const row = rows[0];
  if (!row) return { ok: false, error: "Unknown operator. Check the username." };
  if (row.role !== input.role) {
    return { ok: false, error: `That account is a ${row.role} console, not ${input.role}.` };
  }
  const expected = hashPassword(row.username, input.password);
  if (expected !== row.password_hash) {
    return { ok: false, error: "Incorrect password." };
  }
  const snapshot = await loadSnapshot(true);
  return {
    ok: true,
    user: row.username,
    role: row.role as Role,
    viewId: ROLE_NAV[row.role as Role][0].id,
    snapshot,
  };
}

export async function fileReportDb(
  input: ReportInput,
): Promise<{ incident: Incident; snapshot: OpsSnapshot }> {
  await ensureSeeded();
  const s = await loadMutable();
  s.incidentSeq += 1;
  const inc = buildIncident(input, "INC-" + s.incidentSeq);
  autoDispatch(inc, s.units, s.hospitals);
  const call: CallRecord = {
    id: "CALL-" + inc.id,
    channel: input.channel,
    from: input.from,
    incidentId: inc.id,
    verified: Boolean(input.verified),
    time: nowStr(),
  };
  s.incidents = [inc, ...s.incidents];
  s.calls = [call, ...s.calls];
  if (input.phone || input.channel !== "App") {
    s.smsSeq += 1;
    const etaMsg = inc.assigned.length
      ? `${inc.assigned.length} unit(s) dispatched, nearest ETA ${inc.assigned[0].eta} min.`
      : "Searching for the nearest available unit.";
    s.smsLog = [
      {
        id: "SMS-" + s.smsSeq,
        phone: input.phone || "+256 7XX XXX XXX",
        text: `SafeLink Uganda: Report received. Ref ${inc.id}. ${etaMsg}`,
        time: nowStr(),
      },
      ...s.smsLog,
    ];
  }
  await saveMutable(s, {
    units: true,
    hospitals: true,
    incidents: true,
    calls: true,
    sms: true,
    seqs: true,
  });
  return { incident: inc, snapshot: snapshotOf(s) };
}

export async function verifyCallDb(callId: string): Promise<OpsSnapshot> {
  const s = await loadMutable();
  const call = s.calls.find((c) => c.id === callId);
  if (call) {
    call.verified = true;
    const inc = s.incidents.find((i) => i.id === call.incidentId);
    inc?.log.push(
      `[${nowStr()}] Dispatcher verified report and confirmed auto-dispatch assignment.`,
    );
  }
  await saveMutable(s, { incidents: true, calls: true });
  return snapshotOf(s);
}

export async function requestBackupDb(incId: string): Promise<OpsSnapshot> {
  const s = await loadMutable();
  const inc = s.incidents.find((i) => i.id === incId);
  if (inc) {
    const match = nearestAvailable(
      inc,
      s.units,
      "Ambulance",
      inc.assigned.map((a) => a.unitId),
    );
    if (match) assignUnit(inc, match.u, match.dist);
    else {
      inc.log.push(
        `[${nowStr()}] Manual backup request: no additional ambulances available in range.`,
      );
    }
  }
  await saveMutable(s, { units: true, incidents: true });
  return snapshotOf(s);
}

export async function assignManualDb(
  incId: string,
  unitId: string,
): Promise<{ message: string; snapshot: OpsSnapshot }> {
  const s = await loadMutable();
  const inc = s.incidents.find((i) => i.id === incId);
  const unit = s.units.find((u) => u.id === unitId);
  if (!inc || !unit) return { message: "Unit or incident not found.", snapshot: snapshotOf(s) };
  if (unit.status !== "available") {
    return { message: `${unit.id} is not available.`, snapshot: snapshotOf(s) };
  }
  const d = haversineKm(inc.lat, inc.lng, unit.lat, unit.lng);
  assignUnit(inc, unit, d);
  if (inc.status === "reported") inc.status = "dispatched";
  await saveMutable(s, { units: true, incidents: true });
  const eta = inc.assigned.find((a) => a.unitId === unit.id)?.eta ?? "—";
  return {
    message: `${unit.id} assigned to ${inc.id} — ETA ${eta} min.`,
    snapshot: snapshotOf(s),
  };
}

export async function reassignHospitalDb(
  incId: string,
  hospId: string,
): Promise<OpsSnapshot> {
  const s = await loadMutable();
  const inc = s.incidents.find((i) => i.id === incId);
  if (inc && hospId) linkHospital(inc, s.hospitals, hospId);
  await saveMutable(s, { hospitals: true, incidents: true });
  return snapshotOf(s);
}

export async function advanceIncidentDb(
  id: string,
  status: Incident["status"],
): Promise<OpsSnapshot> {
  const s = await loadMutable();
  const inc = s.incidents.find((i) => i.id === id);
  if (inc) {
    inc.status = status;
    inc.log.push(
      `[${nowStr()}] Status updated to ${status.toUpperCase()} by field unit.`,
    );
    if (status === "onscene") {
      inc.assigned.forEach((a) => {
        const u = s.units.find((x) => x.id === a.unitId);
        if (u && u.status === "enroute") u.status = "busy";
      });
    }
    if (status === "resolved") {
      inc.assigned.forEach((a) => {
        const u = s.units.find((x) => x.id === a.unitId);
        if (u) {
          u.status = "available";
          u.assignedIncident = null;
        }
      });
      releaseHospital(inc, s.hospitals);
    }
  }
  await saveMutable(s, { units: true, hospitals: true, incidents: true });
  return snapshotOf(s);
}

export async function addAmbulanceDb(input: {
  agency: string;
  zoneName: string;
  phone: string;
  type: UnitType;
  capacity: number;
  count: number;
}): Promise<{ message: string; snapshot: OpsSnapshot }> {
  const agency = input.agency.trim();
  if (!agency) {
    const s = await loadMutable();
    return { message: "Enter a service / agency name before onboarding.", snapshot: snapshotOf(s) };
  }
  const s = await loadMutable();
  const zone = LOCATIONS.find((l) => l.name === input.zoneName) || LOCATIONS[0];
  const count = Math.max(1, input.count || 1);
  const newIds: string[] = [];
  for (let i = 0; i < count; i++) {
    s.unitSeq += 1;
    const prefix =
      input.type === "Ambulance" ? "AMB" : input.type === "Fire" ? "FIRE" : "POL";
    const id = `${prefix}-${s.unitSeq}`;
    s.units.push({
      id,
      type: input.type,
      agency,
      country: "Uganda",
      region: zone.region,
      zone: zone.name,
      lat: zone.lat + (Math.random() - 0.5) * 0.01,
      lng: zone.lng + (Math.random() - 0.5) * 0.01,
      status: "available",
      capacity: input.type === "Ambulance" ? input.capacity || 4 : 99,
      phone: input.phone.trim() || "+256 772 000 000",
      assignedIncident: null,
    });
    newIds.push(id);
  }
  await saveMutable(s, { units: true, seqs: true });
  return {
    message: `${agency} onboarded — ${count} unit(s) registered (${newIds.join(", ")}) and live in the auto-dispatch pool for ${zone.name}.`,
    snapshot: snapshotOf(s),
  };
}

export async function addHospitalDb(input: {
  name: string;
  zoneName: string;
  beds: number;
  trauma: number;
  phone: string;
}): Promise<{ message: string; snapshot: OpsSnapshot }> {
  const name = input.name.trim();
  const s = await loadMutable();
  if (!name) {
    return { message: "Enter a hospital name before adding it to the network.", snapshot: snapshotOf(s) };
  }
  const zone = LOCATIONS.find((l) => l.name === input.zoneName) || LOCATIONS[0];
  s.hospitalSeq += 1;
  s.hospitals.push({
    id: "HOSP-" + s.hospitalSeq,
    name,
    country: "Uganda",
    tier: "Private",
    ownership: "Newly onboarded",
    region: zone.region,
    zone: zone.name,
    lat: zone.lat + (Math.random() - 0.5) * 0.01,
    lng: zone.lng + (Math.random() - 0.5) * 0.01,
    bedsTotal: input.beds || 20,
    bedsAvailable: input.beds || 20,
    traumaTotal: input.trauma || 2,
    traumaAvailable: input.trauma || 2,
    phone: input.phone.trim() || "—",
  });
  await saveMutable(s, { hospitals: true, seqs: true });
  return {
    message: `${name} added to the hospital network — now eligible for direct swift-response linking with dispatched EMS units.`,
    snapshot: snapshotOf(s),
  };
}

export async function addEmtDb(input: {
  name: string;
  level: string;
  certBody: string;
  agency: string;
  region: string;
  phone: string;
}): Promise<{ message: string; snapshot: OpsSnapshot }> {
  const name = input.name.trim();
  const s = await loadMutable();
  if (!name) {
    return { message: "Enter the EMT's full name before registering.", snapshot: snapshotOf(s) };
  }
  s.emtSeq += 1;
  const id = "EMT-" + String(s.emtSeq).padStart(3, "0");
  s.emts.push({
    id,
    name,
    level: input.level,
    certBody: input.certBody,
    agency: input.agency.trim() || "Unassigned",
    region: input.region,
    phone: input.phone.trim() || "—",
    status: "On Duty",
  });
  await saveMutable(s, { emts: true, seqs: true });
  return {
    message: `${name} (${id}) registered as a ${input.level}, certified by ${input.certBody}.`,
    snapshot: snapshotOf(s),
  };
}

export async function toggleEmtDutyDb(id: string): Promise<OpsSnapshot> {
  const s = await loadMutable();
  const emt = s.emts.find((e) => e.id === id);
  if (emt) emt.status = emt.status === "On Duty" ? "Off Duty" : "On Duty";
  await saveMutable(s, { emts: true });
  return snapshotOf(s);
}

export async function toggleUnitStatusDb(): Promise<OpsSnapshot> {
  const s = await loadMutable();
  const u = s.units.find((x) => x.id === "AMB-01");
  if (u) u.status = u.status === "available" ? "enroute" : "available";
  await saveMutable(s, { units: true });
  return snapshotOf(s);
}

export async function callProviderDb(key: string): Promise<OpsSnapshot> {
  const s = await loadMutable();
  const dir = [
    ...s.units.map((u) => ({
      key: "unit-" + u.id,
      name: `${u.agency} (${u.id})`,
      phone: u.phone || "+256 772 000 000",
      region: u.region,
    })),
    ...s.hospitals.map((h) => ({
      key: "hosp-" + h.id,
      name: h.name,
      phone: h.phone,
      region: h.region,
    })),
  ];
  const p = dir.find((x) => x.key === key);
  if (!p) return snapshotOf(s);
  s.outboundSeq += 1;
  s.outboundCalls = [
    {
      id: "OUT-" + s.outboundSeq,
      name: p.name,
      phone: p.phone,
      region: p.region,
      status: "logged",
      time: nowStr(),
    },
    ...s.outboundCalls,
  ];
  await saveMutable(s, { outbound: true, seqs: true });
  return snapshotOf(s);
}
