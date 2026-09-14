#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required to import the registry.");

const file = process.argv[2] || "data/uganda-ambulance-registry.csv";
const csv = await readFile(file, "utf8");
const lines = csv.split(/\r?\n/).filter(Boolean);
const headers = parseLine(lines.shift());
const rows = lines.map((line) => Object.fromEntries(parseLine(line).map((value, index) => [headers[index], value ?? ""])));

function parseLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') { value += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { values.push(value.trim()); value = ""; continue; }
    value += char;
  }
  values.push(value.trim());
  return values;
}

function key(row) {
  return [row.entity_type, row.name_or_id, row.location_station, row.district_region]
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .join("|");
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const row of rows) {
    const entityType = row.entity_type || "Unknown";
    const operational = entityType === "Dispatch_Centre" || entityType === "Provider" || entityType === "Highway_Ambulance_Fleet";
    await client.query(
      `insert into sl_uganda_registry
        (registry_key, entity_type, name_or_id, location_station, district_region, type_notes,
         contact_phone, contact_email_or_other, ownership, source_notes, last_updated_approx, is_operational, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
       on conflict (registry_key) do update set
         entity_type = excluded.entity_type,
         name_or_id = excluded.name_or_id,
         location_station = excluded.location_station,
         district_region = excluded.district_region,
         type_notes = excluded.type_notes,
         contact_phone = excluded.contact_phone,
         contact_email_or_other = excluded.contact_email_or_other,
         ownership = excluded.ownership,
         source_notes = excluded.source_notes,
         last_updated_approx = excluded.last_updated_approx,
         is_operational = excluded.is_operational,
         updated_at = now()`,
      [key(row), entityType, row.name_or_id, row.location_station, row.district_region, row.type_notes,
        row.contact_phone, row.contact_email_or_other, row.ownership, row.source_notes, row.last_updated_approx, operational],
    );
  }
  await client.query("COMMIT");
  console.log(`[registry] upserted ${rows.length} Uganda registry records from ${file}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
