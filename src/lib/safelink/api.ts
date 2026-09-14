import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Incident, ReportInput, Role } from "./types";

const roleSchema = z.enum(["admin", "public", "emt", "ems", "dispatcher"]);
const incidentStatus = z.enum([
  "reported",
  "dispatched",
  "enroute",
  "onscene",
  "resolved",
  "escalated",
]);
const reportInput = z.object({
  type: z.string(),
  location: z.string(),
  region: z.string().optional(),
  country: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  casualties: z.number(),
  desc: z.string(),
  source: z.string(),
  reporter: z.string(),
  channel: z.enum(["Voice", "USSD", "WhatsApp", "App"]),
  from: z.string(),
  phone: z.string().optional(),
  verified: z.boolean().optional(),
});

export const loadOpsSnapshot = createServerFn({ method: "GET" }).handler(
  async () => {
    const { loadSnapshot } = await import("./persist");
    return loadSnapshot(true);
  },
);

export const loginOperatorFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      username: z.string().min(1),
      password: z.string().min(1),
      role: roleSchema,
    }),
  )
  .handler(async ({ data }) => {
    const { loginOperator } = await import("./persist");
    return loginOperator(data);
  });

export const listOperatorsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listOperatorsDb } = await import("./persist");
  return listOperatorsDb();
});

export const saveOperatorFn = createServerFn({ method: "POST" })
  .validator(z.object({ username: z.string(), displayName: z.string(), role: roleSchema, password: z.string().optional(), recoveryEmail: z.string().email(), active: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const { saveOperatorDb } = await import("./persist");
    return saveOperatorDb(data);
  });

export const issueOperatorResetTokenFn = createServerFn({ method: "POST" })
  .validator(z.object({ username: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { issueOperatorResetTokenDb } = await import("./persist");
    return issueOperatorResetTokenDb(data.username);
  });

export const fileReportFn = createServerFn({ method: "POST" })
  .validator(reportInput)
  .handler(async ({ data }) => {
    const { fileReportDb } = await import("./persist");
    return fileReportDb(data as ReportInput);
  });

export const verifyCallFn = createServerFn({ method: "POST" })
  .validator(z.object({ callId: z.string() }))
  .handler(async ({ data }) => {
    const { verifyCallDb } = await import("./persist");
    return verifyCallDb(data.callId);
  });

export const requestBackupFn = createServerFn({ method: "POST" })
  .validator(z.object({ incId: z.string() }))
  .handler(async ({ data }) => {
    const { requestBackupDb } = await import("./persist");
    return requestBackupDb(data.incId);
  });

export const assignManualFn = createServerFn({ method: "POST" })
  .validator(z.object({ incId: z.string(), unitId: z.string() }))
  .handler(async ({ data }) => {
    const { assignManualDb } = await import("./persist");
    return assignManualDb(data.incId, data.unitId);
  });

export const reassignHospitalFn = createServerFn({ method: "POST" })
  .validator(z.object({ incId: z.string(), hospId: z.string() }))
  .handler(async ({ data }) => {
    const { reassignHospitalDb } = await import("./persist");
    return reassignHospitalDb(data.incId, data.hospId);
  });

export const advanceIncidentFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), status: incidentStatus }))
  .handler(async ({ data }) => {
    const { advanceIncidentDb } = await import("./persist");
    return advanceIncidentDb(data.id, data.status as Incident["status"]);
  });

export const addAmbulanceFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      agency: z.string(),
      zoneName: z.string(),
      phone: z.string(),
      type: z.enum(["Ambulance", "Police", "Fire"]),
      capacity: z.number(),
      count: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const { addAmbulanceDb } = await import("./persist");
    return addAmbulanceDb(data);
  });

export const addHospitalFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string(),
      zoneName: z.string(),
      beds: z.number(),
      trauma: z.number(),
      phone: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { addHospitalDb } = await import("./persist");
    return addHospitalDb(data);
  });

export const addEmtFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string(),
      level: z.string(),
      certBody: z.string(),
      agency: z.string(),
      region: z.string(),
      phone: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { addEmtDb } = await import("./persist");
    return addEmtDb(data);
  });

export const toggleEmtDutyFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { toggleEmtDutyDb } = await import("./persist");
    return toggleEmtDutyDb(data.id);
  });

export const toggleUnitStatusFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const { toggleUnitStatusDb } = await import("./persist");
    return toggleUnitStatusDb();
  },
);

export const callProviderFn = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string() }))
  .handler(async ({ data }) => {
    const { callProviderDb } = await import("./persist");
    return callProviderDb(data.key);
  });

export type LoginRole = Role;
