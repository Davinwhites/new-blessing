import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useOps } from "@/lib/safelink/store";

export function LiveOps() {
  const refresh = useOps((s) => s.refresh);
  const session = useOps((s) => s.session);
  const known = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    if (!session) {
      primed.current = false;
      known.current = new Set();
      return;
    }
    const ids = useOps.getState().incidents.map((i) => i.id);
    known.current = new Set(ids);
    primed.current = true;
    const id = window.setInterval(async () => {
      const before = new Set(useOps.getState().incidents.map((i) => i.id));
      try {
        await refresh();
      } catch {
        return;
      }
      if (!primed.current) return;
      const after = useOps.getState().incidents;
      for (const inc of after) {
        if (!before.has(inc.id) && !known.current.has(inc.id)) {
          toast(`${inc.id} · ${inc.type}`, {
            description: `${inc.source} — ${inc.location}`,
          });
        }
      }
      known.current = new Set(after.map((i) => i.id));
    }, 2500);
    return () => window.clearInterval(id);
  }, [session, refresh]);

  return null;
}
