import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getSql, type Sql } from "@/lib/db";
import { ROLE_NAV } from "./constants";
import {
  assignUnit,
  autoDispatch,
  buildIncident,
  linkHospital,
  nearestAvailable,
  releaseHospital,
  moveUnitsTowardIncidents,
} from "./engine";
import { haversineKm, nowStr } from "./geo";
import { LOCATIONS } from "./seed";
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

function legacyHashPassword(username: string, password: string): string {
  return createHash("sha256")
    .update(`safelink|${username}|${password}`)
    .digest("hex");
}

function hashPassword(username: string, password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(`${username}\0${password}`, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(username: string, password: string, stored: string): boolean {
  if (stored.startsWith("scrypt$")) {
    const [, salt, expectedHex] = stored.split("$");
    if (!salt || !expectedHex) return false;
    const actual = scryptSync(`${username}\0${password}`, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  }
  const actual = Buffer.from(legacyHashPassword(username, password), "hex");
  const expected = Buffer.from(stored, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
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
  // Production data is provisioned by the connected backend. Never create
  // operators, responders, hospitals, units, incidents, or sample messages
  // implicitly at runtime.
  const sql = await getSql();
  await sql.query("alter table sl_operators add column if not exists recovery_email text");
  await sql.query("alter table sl_operators add column if not exists reset_token_hash text");
  await sql.query("alter table sl_operators add column if not exists reset_token_expires_at timestamptz");
  await sql.query("alter table sl_operators add column if not exists active boolean not null default true");
  await sql.query("alter table sl_operators add column if not exists updated_at timestamptz not null default now()");
  await sql.query("alter table sl_hospitals add column if not exists facility_type text not null default 'Hospital'");
  await sql.query("alter table sl_hospitals add column if not exists district text not null default ''");
  await sql.query("alter table sl_hospitals add column if not exists subcounty text not null default ''");
  await sql.query("alter table sl_hospitals add column if not exists source_url text not null default ''");
  await sql.query("alter table sl_hospitals add column if not exists verification_status text not null default 'needs_verification'");
  await sql.query("alter table sl_hospitals add column if not exists last_verified_at timestamptz");
  await sql.query("alter table sl_hospitals add column if not exists services text not null default ''");
  await sql.query("alter table sl_hospitals add column if not exists address text not null default ''");
  await sql.query("alter table sl_hospitals add column if not exists operating_hours text not null default 'Open 24 hours'");
  await sql.query("alter table sl_hospitals add column if not exists whatsapp text not null default ''");
  await sql.query("alter table sl_incidents add column if not exists district text not null default ''");
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
    facilityType: String(r.facility_type || r.tier || "Hospital"),
    ownership: String(r.ownership),
    region: String(r.region),
    zone: String(r.zone),
    district: String(r.district || r.zone || ""),
    subcounty: String(r.subcounty || ""),
    sourceUrl: String(r.source_url || ""),
    verificationStatus: r.verification_status === "official" ? "official" : "needs_verification",
    lastVerifiedAt: r.last_verified_at ? new Date(String(r.last_verified_at)).toISOString() : null,
    lat: asNumber(r.lat),
    lng: asNumber(r.lng),
    bedsTotal: asNumber(r.beds_total),
    bedsAvailable: asNumber(r.beds_available),
    traumaTotal: asNumber(r.trauma_total),
    traumaAvailable: asNumber(r.trauma_available),
    phone: String(r.phone),
    services: String(r.services || ""),
    address: String(r.address || ""),
    operatingHours: String(r.operating_hours || "Open 24 hours"),
    whatsapp: String(r.whatsapp || ""),
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
  district: String(r.district || ""),
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
      (id, type, location, region, district, country, lat, lng, casualties, description,
       source, reporter, status, time_label, reported_at, assigned, log, hospital_link)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18::jsonb)
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
       district = excluded.district,
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
      i.district || "",
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
  const rows = await sql.query<{ username: string; role: string; password_hash: string; active: boolean }>(
    "select username, role, password_hash, active from sl_operators where username = $1",
    [input.username.trim()],
  );
  const row = rows[0];
  if (!row) return { ok: false, error: "Unknown operator. Check the username." };
  if (row.active === false) return { ok: false, error: "This staff account is inactive. Contact an administrator." };
  if (row.role !== input.role) {
    return { ok: false, error: `That account is a ${row.role} console, not ${input.role}.` };
  }
  if (!verifyPassword(row.username, input.password, row.password_hash)) {
    return { ok: false, error: "Incorrect username or password." };
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

export async function listOperatorsDb(): Promise<{ username: string; displayName: string; role: Role; recoveryEmail: string; active: boolean; updatedAt: string }[]> {
  await ensureSeeded();
  const sql = await getSql();
  const rows = await sql.query<{ username: string; display_name: string; role: Role; recovery_email: string | null; active: boolean; updated_at: Date }>(
    "select username, display_name, role, recovery_email, active, updated_at from sl_operators order by username",
  );
  return rows.map((row) => ({ username: row.username, displayName: row.display_name, role: row.role, recoveryEmail: row.recovery_email ?? "", active: row.active, updatedAt: row.updated_at.toISOString() }));
}

export async function saveOperatorDb(input: {
  username: string;
  displayName: string;
  role: Role;
  password?: string;
  recoveryEmail: string;
  active?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureSeeded();
  const username = input.username.trim();
  const displayName = input.displayName.trim() || username;
  if (!/^[a-z0-9._-]{3,40}$/i.test(username)) return { ok: false, error: "Use 3–40 letters, numbers, dots, dashes, or underscores." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recoveryEmail.trim())) return { ok: false, error: "Enter a valid recovery email." };
  if (input.password !== undefined && input.password.length < 8) return { ok: false, error: "Passwords must be at least 8 characters." };
  const sql = await getSql();
  const existing = await sql.query<{ username: string }>("select username from sl_operators where username = $1", [username]);
  if (!existing[0] && !input.password) return { ok: false, error: "A password is required for a new responder." };
  if (existing[0]) {
    if (input.password) {
      await sql.query("update sl_operators set display_name = $2, role = $3, password_hash = $4, recovery_email = $5, active = $6, updated_at = now(), reset_token_hash = null, reset_token_expires_at = null where username = $1", [username, displayName, input.role, hashPassword(username, input.password), input.recoveryEmail.trim(), input.active ?? true]);
    } else {
      await sql.query("update sl_operators set display_name = $2, role = $3, recovery_email = $4, active = $5, updated_at = now() where username = $1", [username, displayName, input.role, input.recoveryEmail.trim(), input.active ?? true]);
    }
  } else {
    await sql.query("insert into sl_operators (username, display_name, role, password_hash, recovery_email, active) values ($1,$2,$3,$4,$5,$6)", [username, displayName, input.role, hashPassword(username, input.password as string), input.recoveryEmail.trim(), input.active ?? true]);
  }
  return { ok: true };
}

export async function issueOperatorResetTokenDb(usernameInput: string): Promise<{ ok: true; token: string; expiresAt: string } | { ok: false; error: string }> {
  await ensureSeeded();
  const username = usernameInput.trim();
  const sql = await getSql();
  const rows = await sql.query<{ username: string; recovery_email: string | null; active: boolean }>("select username, recovery_email, active from sl_operators where username = $1", [username]);
  const row = rows[0];
  if (!row) return { ok: false, error: "Staff account not found." };
  if (!row.recovery_email) return { ok: false, error: "Add a recovery email before generating a reset token." };
  if (!row.active) return { ok: false, error: "Activate this account before generating a reset token." };
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await sql.query("update sl_operators set reset_token_hash = $2, reset_token_expires_at = $3, updated_at = now() where username = $1", [username, tokenHash, expiresAt]);
  return { ok: true, token, expiresAt: expiresAt.toISOString() };
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
