import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { Hospital, Incident, Unit } from "@/lib/safelink/types";

const UGANDA_CENTER: [number, number] = [1.25, 32.4];
const UGANDA_BOUNDS: [[number, number], [number, number]] = [
  [-1.55, 29.55],
  [4.25, 35.05],
];

const SERVICE_ZONES = [
  { name: "Central", center: [0.31, 32.58] as [number, number], radius: 92000, color: "#e8b84a", summary: "Kampala, Wakiso, Mukono and surrounding districts" },
  { name: "Eastern", center: [1.05, 33.85] as [number, number], radius: 118000, color: "#55b9e8", summary: "Jinja, Mbale, Soroti and eastern districts" },
  { name: "Northern", center: [2.75, 32.35] as [number, number], radius: 145000, color: "#b88cff", summary: "Gulu, Lira, Arua, Moroto and northern districts" },
  { name: "Western", center: [0.05, 30.45] as [number, number], radius: 120000, color: "#3ddc84", summary: "Mbarara, Fort Portal, Kabale and western districts" },
] as const;

function markerIcon(html: string, size: [number, number], anchor: [number, number]) {
  return L.divIcon({
    className: "sl-pin",
    html,
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -anchor[1]],
  });
}

function unitPin(u: Unit) {
  const color =
    u.status === "available" ? "#3ddc84" : u.status === "busy" ? "#e63946" : "#e8b84a";
  return markerIcon(
    `<div class="sl-pin-unit"><i style="background:${color}"></i><b>${u.id}</b></div>`,
    [72, 22],
    [12, 11],
  );
}

function hospitalPin() {
  return markerIcon(
    `<div class="sl-pin-hosp"><span>+</span></div>`,
    [18, 18],
    [9, 9],
  );
}

function incidentPin(selected: boolean) {
  return markerIcon(
    `<div class="sl-pin-inc${selected ? " is-selected" : ""}"><i></i></div>`,
    [28, 28],
    [14, 14],
  );
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 12), { duration: 0.55 });
  }, [lat, lng, map]);
  return null;
}

function Invalidate() {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(t);
  }, [map]);
  return null;
}

type GoogleMapApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
    Marker: new (options: Record<string, unknown>) => { setMap: (map: unknown) => void; addListener?: (event: string, handler: () => void) => void };
    InfoWindow: new (options?: Record<string, unknown>) => { open: (map: unknown, marker: unknown) => void };
  };
};

declare global {
  interface Window {
    google?: GoogleMapApi;
    __safeLinkGoogleMapsPromise?: Promise<GoogleMapApi>;
  }
}

function loadGoogleMaps(apiKey: string) {
  if (window.google) return Promise.resolve(window.google);
  if (window.__safeLinkGoogleMapsPromise) return window.__safeLinkGoogleMapsPromise;
  window.__safeLinkGoogleMapsPromise = new Promise<GoogleMapApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-safelink-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => window.google ? resolve(window.google) : reject(new Error("Google Maps unavailable")));
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.safelinkGoogleMaps = "true";
    script.onload = () => window.google ? resolve(window.google) : reject(new Error("Google Maps unavailable"));
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
  return window.__safeLinkGoogleMapsPromise;
}

function GoogleMap({ hospitals, units, incidents, selectedId, onSelect, onFallback }: Parameters<typeof LeafletMap>[0] & { onFallback: () => void }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = incidents.find((incident) => incident.id === selectedId);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    if (!apiKey || !elementRef.current) return;
    let disposed = false;
    loadGoogleMaps(apiKey).then((google) => {
      if (disposed || !elementRef.current) return;
      const map = new google.maps.Map(elementRef.current, { center: { lat: 1.25, lng: 32.4 }, zoom: 7, streetViewControl: false, mapTypeControl: false });
      const markers: Array<{ lat: number; lng: number; title: string; color: string; id?: string }> = [...hospitals.map((hospital) => ({ lat: hospital.lat, lng: hospital.lng, title: hospital.name, color: "#55b9e8" })), ...units.map((unit) => ({ lat: unit.lat, lng: unit.lng, title: `${unit.id} · ${unit.status}`, color: "#3ddc84" })), ...incidents.map((incident) => ({ lat: incident.lat, lng: incident.lng, title: `${incident.id} · ${incident.type}`, color: "#e63946", id: incident.id }))];
      markers.forEach((item) => {
        const marker = new google.maps.Marker({ map, position: { lat: item.lat, lng: item.lng }, title: item.title, icon: { path: "M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z", fillColor: item.color, fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 1, scale: 1.4, anchor: { x: 12, y: 22 } } });
        if (item.id) marker.addListener?.("click", () => onSelect?.(item.id as string));
      });
      if (selected) (map as { panTo: (position: { lat: number; lng: number }) => void }).panTo({ lat: selected.lat, lng: selected.lng });
    }).catch(() => { if (!disposed) { setError("Google Maps could not load"); onFallback(); } });
    return () => { disposed = true; };
  }, [apiKey, hospitals, units, incidents, selected, onSelect, onFallback]);

  if (!apiKey || error) return null;
  return <div className="h-full w-full" ref={elementRef} aria-label="Live Google map" />;
}

function GoogleMapSources({ selected }: { selected?: Incident }) {
  const location = selected ? `${selected.lat},${selected.lng}` : "1.3733,32.2903";
  const sources = [
    ["Hospitals", `https://www.google.com/maps/search/${selected ? `hospitals+near+${encodeURIComponent(selected.location)}` : "hospitals+in+Uganda"}/@${location},12z`],
    ["Health centres", `https://www.google.com/maps/search/${selected ? `health+centres+near+${encodeURIComponent(selected.location)}` : "health+centres+in+Uganda"}/@${location},12z`],
    ["Uganda overview", "https://www.google.com/maps/@1.3733,32.2903,7z"],
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
      <span className="mr-1 text-xs font-medium text-mute">Google Maps sources{selected ? ` · ${selected.location}` : ""}</span>
      {sources.map(([label, href]) => (
        <a key={href} href={href} target="_blank" rel="noreferrer" className="rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-ink transition-colors hover:border-accent hover:text-accent">
          {label}
        </a>
      ))}
    </div>
  );
}

function MapLegend({ provider }: { provider: string }) {
  return (
    <div className="flex flex-wrap gap-4 border-t border-line px-3 py-2.5 text-xs text-mute">
      <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-ok" />Available unit</span>
      <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-amber" />Unit en route</span>
      <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-alert" />On scene / incident</span>
      <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 bg-mute" />Hospital</span>
      {SERVICE_ZONES.map((zone) => <span key={zone.name} className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: zone.color }} />{zone.name} zone</span>)}
      <span className="ml-auto font-mono text-[0.625rem] uppercase tracking-[0.12em]">{provider} · ambulance coverage</span>
    </div>
  );
}

function LeafletMap({
  hospitals,
  units,
  incidents,
  selectedId,
  onSelect,
}: {
  hospitals: Hospital[];
  units: Unit[];
  incidents: Incident[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const selected = useMemo(
    () => incidents.find((i) => i.id === selectedId),
    [incidents, selectedId],
  );
  const [region, setRegion] = useState("All Uganda");
  const visibleUnits = useMemo(
    () => units.filter((unit) => unit.type !== "Ambulance" || region === "All Uganda" || unit.region === region),
    [units, region],
  );

  return (
    <div className="overflow-hidden rounded-lg bg-panel-2 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      <GoogleMapSources selected={selected} />
      <div className="flex flex-col gap-2 border-b border-line px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-ink">Ambulance coverage zones</p>
          <p className="text-[11px] text-mute">Colored zones show the operational area of known services.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-mute">
          <span className="sr-only">Filter ambulance coverage by region</span>
          <select value={region} onChange={(event) => setRegion(event.target.value)} className="min-h-9 rounded-md border border-line bg-panel px-2 text-xs text-ink">
            <option>All Uganda</option>
            {SERVICE_ZONES.map((zone) => <option key={zone.name}>{zone.name}</option>)}
          </select>
        </label>
      </div>
      <div className="h-[min(56vh,440px)] min-h-[280px] w-full">
        <MapContainer
          center={UGANDA_CENTER}
          zoom={7}
          minZoom={6}
          maxZoom={16}
          maxBounds={UGANDA_BOUNDS}
          maxBoundsViscosity={0.7}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
          <Invalidate />
          {selected && <FlyTo lat={selected.lat} lng={selected.lng} />}
          {SERVICE_ZONES.filter((zone) => region === "All Uganda" || zone.name === region).map((zone) => (
            <Circle key={zone.name} center={zone.center} radius={zone.radius} pathOptions={{ color: zone.color, fillColor: zone.color, fillOpacity: 0.12, weight: 2 }}>
              <Tooltip sticky><strong>{zone.name} service zone</strong><br />{zone.summary}</Tooltip>
            </Circle>
          ))}
          {hospitals.map((h) => (
            <Marker key={h.id} position={[h.lat, h.lng]} icon={hospitalPin()} zIndexOffset={10}>
              <Popup>
                <strong>{h.name}</strong>
                <br />
                {h.tier} · {h.region}
                <br />
                Trauma bays {h.traumaAvailable}/{h.traumaTotal}
                <br />
                {h.phone}
              </Popup>
            </Marker>
          ))}
          {visibleUnits.map((u) => (
            <Marker
              key={u.id}
              position={[u.lat, u.lng]}
              icon={unitPin(u)}
              zIndexOffset={20}
            >
              <Popup>
                <strong>{u.id}</strong> · {u.type}
                <br />
                {u.agency}
                <br />
                {u.zone} · {u.status.toUpperCase()}
                {u.assignedIncident ? (
                  <>
                    <br />
                    Assigned {u.assignedIncident}
                  </>
                ) : null}
              </Popup>
            </Marker>
          ))}
          {incidents.map((i) => (
            <Marker
              key={i.id}
              position={[i.lat, i.lng]}
              icon={incidentPin(selectedId === i.id)}
              zIndexOffset={40}
              eventHandlers={{
                click: () => onSelect?.(i.id),
              }}
            >
              <Popup>
                <strong>{i.id}</strong> · {i.type}
                <br />
                {i.location}
                <br />
                {i.status.toUpperCase()} · {i.casualties} casualties
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <MapLegend provider="OpenStreetMap" />
    </div>
  );
}

export function OpsMapInner(props: Parameters<typeof LeafletMap>[0]) {
  const [useFallback, setUseFallback] = useState(!import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (apiKey && !useFallback) {
    const selected = props.incidents.find((incident) => incident.id === props.selectedId);
    return <div className="overflow-hidden rounded-lg bg-panel-2 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"><GoogleMapSources selected={selected} /><div className="h-[min(56vh,440px)] min-h-[280px] w-full"><GoogleMap {...props} onFallback={() => setUseFallback(true)} /></div><MapLegend provider="Google Maps" /></div>;
  }
  return <LeafletMap {...props} />;
}

