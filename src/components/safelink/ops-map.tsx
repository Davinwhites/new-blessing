import { lazy, Suspense, useEffect, useState } from "react";
import type { Hospital, Incident, Unit } from "@/lib/safelink/types";

const OpsMapInner = lazy(() =>
  import("./ops-map-inner").then((m) => ({ default: m.OpsMapInner })),
);

function MapSkeleton() {
  return (
    <div className="grid h-[min(56vh,440px)] min-h-[280px] place-items-center rounded-lg bg-panel-2 text-sm text-mute">
      Loading map…
    </div>
  );
}

export function OpsMap(props: {
  hospitals: Hospital[];
  units: Unit[];
  incidents: Incident[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <MapSkeleton />;
  return (
    <Suspense fallback={<MapSkeleton />}>
      <OpsMapInner {...props} />
    </Suspense>
  );
}
