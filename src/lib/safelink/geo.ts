import { BOUNDS } from "./constants";

export function nowStr(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function etaMinutes(km: number): number {
  return Math.max(2, Math.round((km / 32) * 60));
}

export function projectXY(lat: number, lng: number): { x: number; y: number } {
  const x =
    30 + ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * 540;
  const y =
    310 - ((lat - BOUNDS.latMin) / (BOUNDS.latMax - BOUNDS.latMin)) * 280;
  return { x, y };
}
