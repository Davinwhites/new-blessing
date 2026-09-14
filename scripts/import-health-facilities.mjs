import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const inputPath = new URL("../data/uganda-health-facilities.csv", import.meta.url);
const sourceUrl = "https://blobs.vusercontent.net/blob/[Pasted-6522-lines]-HbV5MtQm8KWu1C6nFL7QlcEdLwhZ2j";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(field.trim()); field = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim()); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  const headers = rows.shift().map((header) => header.toLowerCase().replaceAll(" ", "_") );
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const text = await readFile(inputPath, "utf8");
const records = parseCsv(text);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
let imported = 0;
try {
  await client.query("begin");
  for (const record of records) {
    const name = record.facility_name?.trim();
    const lat = numberOrNull(record.latitude);
    const lng = numberOrNull(record.longitude);
    if (!name || lat === null || lng === null) continue;
    const id = `UG-${createHash("sha1").update(`${name}|${lat}|${lng}`).digest("hex").slice(0, 14)}`;
    const facilityType = /\bHC\s*(II|III|IV)\b/i.test(name) ? name.match(/\bHC\s*(II|III|IV)\b/i)[0].toUpperCase() : /clinic/i.test(name) ? "Clinic" : /hospital/i.test(name) ? "Hospital" : "Health facility";
    await client.query(`
      insert into sl_hospitals (id, name, country, tier, facility_type, ownership, region, zone, district, subcounty, source_url, verification_status, last_verified_at, lat, lng, beds_total, beds_available, trauma_total, trauma_available, phone)
      values ($1, $2, 'Uganda', $3, $4, $5, $6, $7, $8, $9, $10, 'needs_verification', now(), $11, $12, 0, 0, 0, 0, $13)
      on conflict (id) do update set name = excluded.name, tier = excluded.tier, facility_type = excluded.facility_type, ownership = excluded.ownership, subcounty = excluded.subcounty, source_url = excluded.source_url, last_verified_at = excluded.last_verified_at, lat = excluded.lat, lng = excluded.lng, phone = excluded.phone
    `, [id, name, facilityType, facilityType, record.care_system || "", "Not provided", record.subcounty || "", "Not provided", record.subcounty || "", sourceUrl, lat, lng, record.phone_number || ""]);
    imported += 1;
  }
  await client.query("commit");
  console.log(`Imported ${imported} facility records. Region and district remain marked as not provided where absent from the supplied dataset.`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
