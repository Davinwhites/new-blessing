import { LOCATIONS } from "./seed";
import { etaMinutes, haversineKm, nowStr } from "./geo";
import type {
  Hospital,
  Incident,
  Location,
  ReportInput,
  Unit,
  UnitType,
} from "./types";

export function matchLocation(raw: string): Location {
  const loc = raw.toLowerCase();
  return (
    LOCATIONS.find((l) => l.name.toLowerCase().includes(loc)) ||
    LOCATIONS.find((l) => loc.includes(l.name.split(" ")[0].toLowerCase())) ||
    LOCATIONS[1]
  );
}

export function nearestAvailable(
  inc: Incident,
  units: Unit[],
  type: UnitType,
  excludeIds: string[] = [],
): { u: Unit; dist: number } | undefined {
  return units
    .filter(
      (u) =>
        u.type === type &&
        u.status === "available" &&
        !excludeIds.includes(u.id) &&
        u.country === (inc.country || "Uganda"),
    )
    .map((u) => ({ u, dist: haversineKm(inc.lat, inc.lng, u.lat, u.lng) }))
    .sort((a, b) => a.dist - b.dist)[0];
}

export function assignUnit(inc: Incident, unit: Unit, dist: number): void {
  unit.status = "enroute";
  unit.assignedIncident = inc.id;
  const eta = etaMinutes(dist);
  inc.assigned.push({
    unitId: unit.id,
    type: unit.type,
    dist: dist.toFixed(1),
    eta,
  });
  inc.log.push(
    `[${nowStr()}] Auto-dispatch: ${unit.type} ${unit.id} (${unit.agency}) matched — ${dist.toFixed(1)} km away, ETA ${eta} min.`,
  );
}

export function releaseHospital(inc: Incident, hospitals: Hospital[]): void {
  if (!inc.hospitalLink) return;
  const h = hospitals.find((x) => x.id === inc.hospitalLink!.hospitalId);
  if (h) {
    h.traumaAvailable = Math.min(
      h.traumaTotal,
      h.traumaAvailable + inc.hospitalLink.traumaReserved,
    );
  }
  inc.hospitalLink = null;
}

export function linkHospital(
  inc: Incident,
  hospitals: Hospital[],
  preferredHospitalId?: string,
): void {
  if (!hospitals.length) return;
  const ranked = hospitals
    .map((h) => {
      const dist = haversineKm(inc.lat, inc.lng, h.lat, h.lng);
      const label = `${h.name} ${h.tier} ${h.ownership}`;
      let score = dist;
      if (/mental/i.test(label)) score += 800;
      if (h.traumaAvailable <= 0) score += 400;
      if (inc.casualties >= 4 && h.traumaAvailable < Math.ceil(inc.casualties / 4)) {
        score += 50;
      }
      if (/National Referral/i.test(h.name)) score -= 10;
      if (/Regional Referral/i.test(h.name)) score -= 4;
      if ((h.country || "Uganda") !== (inc.country || "Uganda")) score += 200;
      return { h, dist, score };
    })
    .sort((a, b) => a.score - b.score);

  let choice = preferredHospitalId
    ? ranked.find((c) => c.h.id === preferredHospitalId)
    : undefined;
  if (!choice) {
    choice = ranked.find((c) => c.h.traumaAvailable > 0) || ranked[0];
  }
  if (!choice) return;

  if (inc.hospitalLink) releaseHospital(inc, hospitals);

  const reserve = Math.max(
    1,
    Math.min(choice.h.traumaAvailable, Math.ceil(inc.casualties / 4)),
  );
  choice.h.traumaAvailable = Math.max(0, choice.h.traumaAvailable - reserve);
  inc.hospitalLink = {
    hospitalId: choice.h.id,
    name: choice.h.name,
    dist: choice.dist.toFixed(1),
    eta: etaMinutes(choice.dist),
    traumaReserved: reserve,
  };
  inc.log.push(
    `[${nowStr()}] Swift-response link established with ${choice.h.name} (${choice.dist.toFixed(1)} km, ETA ${etaMinutes(choice.dist)} min) — ${reserve} trauma bay(s) reserved.`,
  );
}

export function autoDispatch(
  inc: Incident,
  units: Unit[],
  hospitals: Hospital[],
): void {
  const ambMatch = nearestAvailable(inc, units, "Ambulance");
  const assignedAmb: Unit[] = [];
  if (ambMatch) {
    assignUnit(inc, ambMatch.u, ambMatch.dist);
    assignedAmb.push(ambMatch.u);
  } else {
    inc.log.push(
      `[${nowStr()}] No ambulance currently available near ${inc.location}.`,
    );
  }

  const unitsNeeded = Math.ceil(inc.casualties / 4);
  if (unitsNeeded > 1) {
    inc.log.push(
      `[${nowStr()}] Capacity check: ${inc.casualties} casualties reported — requesting ${unitsNeeded} ambulance units (multi-casualty protocol).`,
    );
    const excl = assignedAmb.map((u) => u.id);
    for (let i = 1; i < unitsNeeded; i++) {
      const next = nearestAvailable(inc, units, "Ambulance", excl);
      if (next) {
        assignUnit(inc, next.u, next.dist);
        excl.push(next.u.id);
      } else {
        inc.log.push(
          `[${nowStr()}] Backup unit ${i + 1} not available — escalated to district emergency operations centre.`,
        );
        inc.status = "escalated";
      }
    }
  }

  const polMatch = nearestAvailable(inc, units, "Police");
  if (polMatch) assignUnit(inc, polMatch.u, polMatch.dist);

  if (inc.type === "Fire") {
    const fireMatch = nearestAvailable(inc, units, "Fire");
    if (fireMatch) assignUnit(inc, fireMatch.u, fireMatch.dist);
    else {
      inc.log.push(
        `[${nowStr()}] No fire brigade unit currently available near ${inc.location}.`,
      );
    }
  }

  linkHospital(inc, hospitals);
  if (inc.assigned.length) {
    inc.status = inc.status === "escalated" ? "escalated" : "dispatched";
  }
}

export function buildIncident(input: ReportInput, id: string): Incident {
  const time = nowStr();
  const inc: Incident = {
    id,
    type: input.type,
    location: input.location,
    region: input.region || "Central",
    country: input.country || "Uganda",
    lat: input.lat,
    lng: input.lng,
    casualties: input.casualties || 1,
    desc: input.desc,
    source: input.source,
    reporter: input.reporter,
    status: "reported",
    assigned: [],
    time,
    reportedAt: Date.now(),
    log: [`[${time}] Incident ${id} received via ${input.source}.`],
    hospitalLink: null,
  };
  return inc;
}

export function moveUnitsTowardIncidents(
  units: Unit[],
  incidents: Incident[],
): { arrived: string[] } {
  const arrived: string[] = [];
  for (const u of units) {
    if (!u.assignedIncident || u.status === "available") continue;
    const inc = incidents.find((i) => i.id === u.assignedIncident);
    if (!inc || inc.status === "resolved") continue;
    const dist = haversineKm(u.lat, u.lng, inc.lat, inc.lng);
    if (dist < 0.38) {
      u.status = "busy";
      u.lat = inc.lat;
      u.lng = inc.lng;
      const a = inc.assigned.find((x) => x.unitId === u.id);
      if (a) {
        a.dist = "0.0";
        a.eta = 0;
      }
      if (
        inc.status === "dispatched" ||
        inc.status === "enroute" ||
        inc.status === "reported" ||
        inc.status === "escalated"
      ) {
        inc.status = "onscene";
        inc.log.push(
          `[${nowStr()}] ${u.id} on scene at ${inc.location}.`,
        );
        arrived.push(inc.id);
      }
    } else {
      const step = 0.16;
      u.lat += (inc.lat - u.lat) * step;
      u.lng += (inc.lng - u.lng) * step;
      const nd = haversineKm(u.lat, u.lng, inc.lat, inc.lng);
      const a = inc.assigned.find((x) => x.unitId === u.id);
      if (a) {
        a.dist = nd.toFixed(1);
        a.eta = etaMinutes(nd);
      }
      if (inc.status === "dispatched") {
        inc.status = "enroute";
        inc.log.push(`[${nowStr()}] ${u.id} rolling — ${nd.toFixed(1)} km remaining.`);
      }
    }
  }
  return { arrived };
}
