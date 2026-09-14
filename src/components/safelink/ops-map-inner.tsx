import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Hospital, Incident, Unit } from "@/lib/safelink/types";

const UGANDA_CENTER: [number, number] = [1.25, 32.4];
const UGANDA_BOUNDS: [[number, number], [number, number]] = [
  [-1.55, 29.55],
  [4.25, 35.05],
];

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

export function OpsMapInner({
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

  return (
    <div className="overflow-hidden rounded-lg bg-panel-2 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
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
          {units.map((u) => (
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
      <div className="flex flex-wrap gap-4 border-t border-line px-3 py-2.5 text-xs text-mute">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full bg-ok" />
          Available unit
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full bg-amber" />
          Unit en route
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full bg-alert" />
          On scene / incident
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 bg-mute" />
          Hospital
        </span>
        <span className="ml-auto font-mono text-[0.625rem] uppercase tracking-[0.12em]">
          OpenStreetMap · live positions
        </span>
      </div>
    </div>
  );
}
