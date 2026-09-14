export type Role = "admin" | "public" | "emt" | "ems" | "dispatcher";

export type UnitType = "Ambulance" | "Police" | "Fire";
export type UnitStatus = "available" | "enroute" | "busy";
export type IncidentStatus =
  | "reported"
  | "dispatched"
  | "enroute"
  | "onscene"
  | "resolved"
  | "escalated";
export type Channel = "Voice" | "USSD" | "WhatsApp" | "App";

export interface Location {
  name: string;
  region: string;
  lat: number;
  lng: number;
}

export interface Unit {
  id: string;
  type: UnitType;
  agency: string;
  country: string;
  region: string;
  zone: string;
  lat: number;
  lng: number;
  status: UnitStatus;
  capacity: number;
  phone: string;
  assignedIncident: string | null;
}

export interface Hospital {
  id: string;
  name: string;
  country: string;
  tier: string;
  facilityType?: string;
  ownership: string;
  region: string;
  zone: string;
  district?: string;
  subcounty?: string;
  sourceUrl?: string;
  verificationStatus?: "official" | "needs_verification";
  lastVerifiedAt?: string | null;
  lat: number;
  lng: number;
  bedsTotal: number;
  bedsAvailable: number;
  traumaTotal: number;
  traumaAvailable: number;
  phone: string;
}

export interface Emt {
  id: string;
  name: string;
  level: string;
  certBody: string;
  agency: string;
  region: string;
  phone: string;
  status: "On Duty" | "Off Duty";
}

export interface Assignment {
  unitId: string;
  type: UnitType;
  dist: string;
  eta: number;
}

export interface HospitalLink {
  hospitalId: string;
  name: string;
  dist: string;
  eta: number;
  traumaReserved: number;
}

export interface Incident {
  id: string;
  type: string;
  location: string;
  region: string;
  district?: string;
  country: string;
  lat: number;
  lng: number;
  casualties: number;
  desc: string;
  source: string;
  reporter: string;
  status: IncidentStatus;
  assigned: Assignment[];
  time: string;
  reportedAt: number;
  log: string[];
  hospitalLink: HospitalLink | null;
}

export interface CallRecord {
  id: string;
  channel: Channel;
  from: string;
  incidentId: string;
  verified: boolean;
  time: string;
}

export interface OutboundCall {
  id: string;
  name: string;
  phone: string;
  region: string;
  status: "logged";
  time: string;
}

export interface SmsMessage {
  id: string;
  phone: string;
  text: string;
  time: string;
}

export interface ReportInput {
  type: string;
  location: string;
  region?: string;
  district?: string;
  country?: string;
  lat: number;
  lng: number;
  casualties: number;
  desc: string;
  source: string;
  reporter: string;
  channel: Channel;
  from: string;
  phone?: string;
  verified?: boolean;
}

export interface NavItem {
  id: string;
  label: string;
}

export interface OpsSnapshot {
  units: Unit[];
  hospitals: Hospital[];
  emts: Emt[];
  incidents: Incident[];
  calls: CallRecord[];
  outboundCalls: OutboundCall[];
  smsLog: SmsMessage[];
  incidentSeq: number;
  unitSeq: number;
  hospitalSeq: number;
  emtSeq: number;
  smsSeq: number;
  outboundSeq: number;
}

