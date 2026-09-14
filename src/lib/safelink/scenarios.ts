import type { Channel } from "./types";

export interface SimScenario {
  type: string;
  locationHint: string;
  casualties: number;
  desc: string;
  channel: Channel;
  reporter: string;
}

export const SIM_SCENARIOS: SimScenario[] = [
  {
    type: "Road traffic accident",
    locationHint: "Seeta",
    casualties: 3,
    desc: "Minibus taxi collision with a lorry on the Kampala–Jinja Highway. Multiple injuries, one lane blocked.",
    channel: "Voice",
    reporter: "Bystander (919)",
  },
  {
    type: "Medical emergency",
    locationHint: "Gulu",
    casualties: 1,
    desc: "Elderly patient collapsed at the market — suspected stroke. Family requesting ambulance.",
    channel: "USSD",
    reporter: "USSD caller",
  },
  {
    type: "Fire",
    locationHint: "Jinja",
    casualties: 2,
    desc: "Market stall fire spreading to adjacent kiosks. Two people with burns, crowd gathering.",
    channel: "WhatsApp",
    reporter: "WhatsApp user",
  },
  {
    type: "Road traffic accident",
    locationHint: "Mbale",
    casualties: 4,
    desc: "Boda-boda versus pickup. Two riders down, one unresponsive. Traffic backing up.",
    channel: "Voice",
    reporter: "Traffic officer",
  },
  {
    type: "Medical emergency",
    locationHint: "Kampala City",
    casualties: 1,
    desc: "Woman in labour delayed at roadside. Requesting nearest obstetric-capable ambulance.",
    channel: "App",
    reporter: "citizen.app",
  },
  {
    type: "Other",
    locationHint: "Tororo",
    casualties: 2,
    desc: "Construction scaffolding collapse — two workers trapped under debris.",
    channel: "Voice",
    reporter: "Site supervisor (919)",
  },
  {
    type: "Fire",
    locationHint: "Kajjansi",
    casualties: 1,
    desc: "Residential house fire. Neighbours evacuated, one person with smoke inhalation.",
    channel: "WhatsApp",
    reporter: "WhatsApp user",
  },
  {
    type: "Medical emergency",
    locationHint: "Mbarara",
    casualties: 1,
    desc: "Child with severe malaria, convulsions. Clinic requesting transfer to regional referral.",
    channel: "USSD",
    reporter: "Clinic nurse",
  },
  {
    type: "Road traffic accident",
    locationHint: "Masaka",
    casualties: 5,
    desc: "Coach versus trailer on Kampala–Mbarara Highway. Multiple casualties, fuel spill risk.",
    channel: "Voice",
    reporter: "Highway patrol",
  },
  {
    type: "Rail crossing collision",
    locationHint: "Mukono",
    casualties: 2,
    desc: "Motorcycle struck at an ungated crossing. Rider thrown, pillion walking wounded.",
    channel: "App",
    reporter: "citizen.app",
  },
];
