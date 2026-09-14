import { create } from "zustand";
import {
  addAmbulanceFn,
  addEmtFn,
  addHospitalFn,
  advanceIncidentFn,
  assignManualFn,
  callProviderFn,
  listOperatorsFn,
  saveOperatorFn,
  issueOperatorResetTokenFn,
  fileReportFn,
  loadOpsSnapshot,
  loginOperatorFn,
  reassignHospitalFn,
  requestBackupFn,
  toggleEmtDutyFn,
  toggleUnitStatusFn,
  verifyCallFn,
} from "./api";
import { DEFAULT_USER, ROLE_NAV } from "./constants";
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

const SESSION_KEY = "safelink.session.v3";

function applySnap(
  set: (partial: Partial<OpsState>) => void,
  snap: OpsSnapshot,
): void {
  set({
    units: snap.units,
    hospitals: snap.hospitals,
    emts: snap.emts,
    incidents: snap.incidents,
    calls: snap.calls,
    outboundCalls: snap.outboundCalls,
    smsLog: snap.smsLog,
    incidentSeq: snap.incidentSeq,
    unitSeq: snap.unitSeq,
    hospitalSeq: snap.hospitalSeq,
    emtSeq: snap.emtSeq,
    smsSeq: snap.smsSeq,
    outboundSeq: snap.outboundSeq,
  });
}

export interface OpsState {
  hydrated: boolean;
  session: { role: Role; user: string } | null;
  viewId: string;
  regionFilter: string;
  units: Unit[];
  hospitals: Hospital[];
  emts: Emt[];
  incidents: Incident[];
  calls: CallRecord[];
  outboundCalls: OutboundCall[];
  smsLog: SmsMessage[];
  lastPublicIncidentId: string | null;
  lastIntake: string | null;
  liveAlert: Incident | null;
  clearLiveAlert: () => void;
  selectedIncidentId: string | null;
  incidentSeq: number;
  unitSeq: number;
  hospitalSeq: number;
  emtSeq: number;
  smsSeq: number;
  outboundSeq: number;
  ussdOpen: boolean;
  waOpen: boolean;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  login: (role: Role, user: string, password: string) => Promise<string | null>;
  logout: () => void;
  setView: (id: string) => void;
  setRegionFilter: (region: string) => void;
  setUssdOpen: (open: boolean) => void;
  setWaOpen: (open: boolean) => void;
  selectIncident: (id: string | null) => void;
  fileReport: (input: ReportInput) => Promise<Incident>;
  verifyCall: (callId: string) => Promise<void>;
  requestBackup: (incId: string) => Promise<void>;
  reassignHospital: (incId: string, hospId: string) => Promise<void>;
  advanceIncident: (id: string, status: Incident["status"]) => Promise<void>;
  assignManual: (incId: string, unitId: string) => Promise<string | null>;
  logIntake: (triage: string, patients: string) => void;
  addAmbulanceService: (input: {
    agency: string;
    zoneName: string;
    phone: string;
    type: UnitType;
    capacity: number;
    count: number;
  }) => Promise<string | null>;
  addHospital: (input: {
    name: string;
    zoneName: string;
    beds: number;
    trauma: number;
    phone: string;
  }) => Promise<string | null>;
  addEmt: (input: {
    name: string;
    level: string;
    certBody: string;
    agency: string;
    region: string;
    phone: string;
  }) => Promise<string | null>;
  toggleEmtDuty: (id: string) => Promise<void>;
  toggleUnitStatus: () => Promise<void>;
  callProvider: (key: string) => Promise<void>;
  listOperators: () => Promise<{ username: string; displayName: string; role: Role; recoveryEmail: string; active: boolean; updatedAt: string }[]>;
  saveOperator: (input: { username: string; displayName: string; role: Role; password?: string; recoveryEmail: string; active?: boolean }) => Promise<string | null>;
  issueResetToken: (username: string) => Promise<{ token: string; expiresAt: string } | string>;
}

export const useOps = create<OpsState>((set, get) => ({
  hydrated: false,
  session: null,
  viewId: "admin-overview",
  regionFilter: "All",
  units: [],
  hospitals: [],
  emts: [],
  incidents: [],
  calls: [],
  outboundCalls: [],
  smsLog: [],
  lastPublicIncidentId: null,
  lastIntake: null,
  liveAlert: null,
  selectedIncidentId: null,
  incidentSeq: 1000,
  unitSeq: 40,
  hospitalSeq: 27,
  emtSeq: 10,
  smsSeq: 0,
  outboundSeq: 0,
  ussdOpen: false,
  waOpen: false,

  hydrate: async () => {
    if (get().hydrated) return;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(SESSION_KEY);
        if (raw) {
          const data = JSON.parse(raw) as {
            session?: OpsState["session"];
            viewId?: string;
            regionFilter?: string;
            lastPublicIncidentId?: string | null;
          };
          set({
            session: data.session ?? null,
            viewId: data.viewId || ROLE_NAV[data.session?.role || "dispatcher"][0].id,
            regionFilter: data.regionFilter || "All",
            lastPublicIncidentId: data.lastPublicIncidentId ?? null,
          });
        }
      } catch {
        /* ignore */
      }
    }
    try {
      const snap = await loadOpsSnapshot();
      applySnap(set, snap);
    } catch (err) {
      console.error("[safelink] snapshot failed", err);
    }
    set({ hydrated: true });
  },

  refresh: async () => {
    const previous = get().incidents;
    const snap = await loadOpsSnapshot();
    applySnap(set, snap);
    const newest = snap.incidents
      .filter((incident) => !previous.some((item) => item.id === incident.id))
      .sort((a, b) => b.reportedAt - a.reportedAt)[0];
    if (newest && get().session) {
      set({ liveAlert: newest });
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("New SafeLink emergency", { body: `${newest.type} reported at ${newest.location}` });
      }
    }
  },

  login: async (role, user, password) => {
    const name = user.trim() || DEFAULT_USER[role];
    const res = await loginOperatorFn({
      data: { username: name, password, role },
    });
    if (!res.ok) return res.error;
    applySnap(set, res.snapshot);
    set({
      session: { role: res.role, user: res.user },
      viewId: res.viewId,
    });
    return null;
  },

  logout: () =>
    set({
      session: null,
      viewId: "admin-overview",
      lastIntake: null,
      ussdOpen: false,
      waOpen: false,
      selectedIncidentId: null,
    }),

  setView: (id) => set({ viewId: id, selectedIncidentId: null }),
  setRegionFilter: (region) => set({ regionFilter: region }),
  setUssdOpen: (open) => set({ ussdOpen: open }),
  setWaOpen: (open) => set({ waOpen: open }),
  selectIncident: (id) => set({ selectedIncidentId: id }),
  clearLiveAlert: () => set({ liveAlert: null }),

  fileReport: async (input) => {
    const res = await fileReportFn({ data: input });
    applySnap(set, res.snapshot);
    if (input.channel === "App") set({ lastPublicIncidentId: res.incident.id });
    return res.incident;
  },

  verifyCall: async (callId) => {
    applySnap(set, await verifyCallFn({ data: { callId } }));
  },

  requestBackup: async (incId) => {
    applySnap(set, await requestBackupFn({ data: { incId } }));
  },

  assignManual: async (incId, unitId) => {
    const res = await assignManualFn({ data: { incId, unitId } });
    applySnap(set, res.snapshot);
    return res.message;
  },

  reassignHospital: async (incId, hospId) => {
    if (!hospId) return;
    applySnap(set, await reassignHospitalFn({ data: { incId, hospId } }));
  },

  advanceIncident: async (id, status) => {
    applySnap(set, await advanceIncidentFn({ data: { id, status } }));
  },

  logIntake: (triage, patients) => {
    set({
      lastIntake: `Patient intake logged: ${patients} patient(s), triage: ${triage}. Hospital handover record created.`,
    });
  },

  addAmbulanceService: async (input) => {
    const res = await addAmbulanceFn({ data: input });
    applySnap(set, res.snapshot);
    return res.message;
  },

  addHospital: async (input) => {
    const res = await addHospitalFn({ data: input });
    applySnap(set, res.snapshot);
    return res.message;
  },

  addEmt: async (input) => {
    const res = await addEmtFn({ data: input });
    applySnap(set, res.snapshot);
    return res.message;
  },

  toggleEmtDuty: async (id) => {
    applySnap(set, await toggleEmtDutyFn({ data: { id } }));
  },

  toggleUnitStatus: async () => {
    applySnap(set, await toggleUnitStatusFn());
  },

  listOperators: async () => listOperatorsFn(),

  saveOperator: async (input) => {
    const result = await saveOperatorFn({ data: input });
    return result.ok ? null : result.error;
  },

  issueResetToken: async (username) => {
    const result = await issueOperatorResetTokenFn({ data: { username } });
    return result.ok ? { token: result.token, expiresAt: result.expiresAt } : result.error;
  },

  callProvider: async (key) => {
    applySnap(set, await callProviderFn({ data: { key } }));
  },
}));

if (typeof window !== "undefined") {
  useOps.subscribe((s) => {
    if (!s.hydrated) return;
    try {
      window.localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          session: s.session,
          viewId: s.viewId,
          regionFilter: s.regionFilter,
          lastPublicIncidentId: s.lastPublicIncidentId,
        }),
      );
    } catch {
      /* quota */
    }
  });
}
