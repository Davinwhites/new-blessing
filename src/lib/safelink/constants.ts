import type { NavItem, Role } from "./types";

export const BOUNDS = {
  latMin: -1.55,
  latMax: 4.35,
  lngMin: 29.5,
  lngMax: 35.1,
};

export const REGIONS = ["Central", "Eastern", "Northern", "Western"] as const;

export const EAC_COUNTRIES = [
  "Kenya",
  "Tanzania",
  "Rwanda",
  "Burundi",
  "South Sudan",
  "DR Congo",
] as const;

export const COUNTRIES = ["Uganda", ...EAC_COUNTRIES] as const;

export const SAFELINK_NUMBERS = {
  direct: "919",
  ussd: "*919#",
  tollFree: "0800 191 911",
  whatsapp: "+256 919 000 001",
};

export const EMERGENCY_TYPES = [
  "Road traffic accident",
  "Rail crossing collision",
  "Medical emergency",
  "Fire",
  "Other",
] as const;

export const USSD_TYPES = [
  "Road Traffic Accident",
  "Rail Crossing Collision",
  "Medical Emergency",
  "Fire",
  "Other",
] as const;

export const ROLE_LABELS: Record<Role, string> = {
  admin: "ADMIN",
  public: "PUBLIC USER",
  emt: "EMT",
  ems: "EMS RESPONDER",
  dispatcher: "DISPATCHER",
};

export const ROLE_NAV: Record<Role, NavItem[]> = {
  admin: [
    { id: "admin-overview", label: "National Overview" },
    { id: "admin-fleet", label: "Ambulance Services & Fleet" },
    { id: "admin-hospitals", label: "Hospital Network" },
    { id: "admin-directory", label: "National Directory" },
    { id: "emt-registry", label: "EMT Registry" },
    { id: "callintegration", label: "Call & USSD Integration" },
    { id: "admin-analytics", label: "Analytics" },
    { id: "admin-accounts", label: "Staff accounts" },
  ],
  public: [{ id: "public-report", label: "Report Emergency" }],
  emt: [
    { id: "emt-assignments", label: "My Assignments" },
    { id: "emt-registry", label: "EMT Registry" },
  ],
  ems: [{ id: "ems-unit", label: "Unit Console" }],
  dispatcher: [
    { id: "dispatch-console", label: "Call Queue" },
    { id: "dispatch-callcentre", label: "National Call Centre" },
    { id: "callintegration", label: "Call & USSD Integration" },
    { id: "dispatch-map", label: "Live Map" },
  ],
};

export const OPERATOR_PASSWORD = "1234";

export const DEFAULT_USER: Record<Role, string> = {
  admin: "admin",
  public: "citizen.elisha",
  emt: "emt.namutebi",
  ems: "ambulance.amb01",
  dispatcher: "dispatcher.mukono",
};

export const ROLE_TITLES: Record<Role, string> = {
  admin: "Admin",
  public: "Public User",
  emt: "EMT",
  ems: "EMS Responder",
  dispatcher: "Dispatcher",
};

export const ROLE_BLURB: Record<Role, string> = {
  admin: "Full system oversight",
  public: "Report an emergency",
  emt: "Field medical crew",
  ems: "Ambulance / rescue unit",
  dispatcher: "Call centre console",
};

export const CERT_BODIES = [
  "AAPU (Association of Ambulance Professionals Uganda)",
  "Uganda Nurses & Midwives Council",
  "Allied Health Professionals Council",
] as const;

export const EMT_LEVELS = ["Basic EMT", "Advanced EMT", "Paramedic"] as const;
