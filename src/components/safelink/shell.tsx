import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Ambulance,
  BarChart3,
  Building2,
  ClipboardList,
  Headset,
  IdCard,
  LayoutDashboard,
  ListOrdered,
  Map,
  MessageCircle,
  Phone,
  Radio,
  Siren,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, ROLE_NAV } from "@/lib/safelink/constants";
import { useOps } from "@/lib/safelink/store";
import { cn } from "@/lib/utils";
import { KampalaClock } from "./clock";
import { IncidentPanel } from "./incident-panel";
import { LiveOps } from "./live-ops";
import { Wordmark } from "./mark";
import {
  AdminOverview,
  AdminAccountsView,
  AnalyticsView,
  FleetView,
  HospitalsView,
  NationalDirectoryView,
} from "./views-admin";
import {
  CallCentreView,
  CallIntegrationView,
  DispatchMapView,
  DispatchQueueView,
  EmsConsoleView,
  EmtAssignmentsView,
  EmtRegistryView,
  PublicReportView,
} from "./views-ops";

const NAV_ICONS: Record<string, LucideIcon> = {
  "admin-overview": LayoutDashboard,
  "admin-fleet": Ambulance,
  "admin-hospitals": Building2,
  "admin-directory": Phone,
  "emt-registry": IdCard,
  callintegration: Phone,
  "admin-analytics": BarChart3,
  "public-report": Siren,
  "emt-assignments": ClipboardList,
  "ems-unit": Radio,
  "dispatch-console": ListOrdered,
  "dispatch-callcentre": Headset,
  "dispatch-map": Map,
};

export function AppShell() {
  const session = useOps((s) => s.session);
  const viewId = useOps((s) => s.viewId);
  const setView = useOps((s) => s.setView);
  const logout = useOps((s) => s.logout);
  const setUssdOpen = useOps((s) => s.setUssdOpen);
  const setWaOpen = useOps((s) => s.setWaOpen);
  const selectIncident = useOps((s) => s.selectIncident);
  const refresh = useOps((s) => s.refresh);
  const liveAlert = useOps((s) => s.liveAlert);
  const clearLiveAlert = useOps((s) => s.clearLiveAlert);
  const safeRole = session?.role ?? "dispatcher";
  const safeUser = session?.user ?? "";
  const nav = ROLE_NAV[safeRole];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") selectIncident(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectIncident]);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 3000);
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (!session) {
    return <div className="min-h-dvh bg-navy" aria-busy="true" />;
  }

  return (
    <div className="min-h-dvh bg-navy text-ink">
      <LiveOps />
      {liveAlert && (
        <div className="sticky top-0 z-50 border-b border-alert/40 bg-alert/15 px-4 py-3 text-sm text-ink shadow-lg">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div><strong>New emergency received:</strong> {liveAlert.type} at {liveAlert.location} <span className="ml-2 font-mono text-xs text-mute">{new Date(liveAlert.reportedAt).toLocaleString("en-UG", { timeZone: "Africa/Kampala" })}</span></div>
            <button type="button" onClick={clearLiveAlert} className="rounded border border-line px-2 py-1 text-xs">Dismiss</button>
          </div>
        </div>
      )}
      <div className="flag-stripe" />
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-panel-2/95 px-3 backdrop-blur-sm sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Wordmark compact />
          <span className="hidden truncate text-xs text-mute lg:inline">
            National Emergency Response
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-mute sm:gap-3">
          <KampalaClock />
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span className="pulse-dot inline-block size-1.5 rounded-full bg-ok" />
            Live
          </span>
          <span className="rounded-full bg-panel px-2.5 py-1 font-mono text-[0.6875rem] text-amber shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
            {ROLE_LABELS[safeRole]}
          </span>
          <span className="hidden max-w-[9rem] truncate sm:inline">            {safeUser}
</span>
          <Button variant="ghost" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>
      <div className="grid min-h-[calc(100dvh-59px)] md:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto border-b border-line bg-panel-2 p-2 md:sticky md:top-[59px] md:h-[calc(100dvh-59px)] md:flex-col md:overflow-y-auto md:border-r md:border-b-0 md:p-3">
          {nav.map((item) => {
            const Icon = NAV_ICONS[item.id] ?? LayoutDashboard;
            const active = viewId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150",
                  active
                    ? "bg-panel text-ink shadow-[inset_3px_0_0_0_var(--color-alert)]"
                    : "text-mute hover:bg-panel/60 hover:text-ink",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-alert" : "text-mute")} />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
          <div className="mt-auto hidden flex-col gap-1.5 border-t border-line pt-3 md:flex">
            <button
              type="button"
              onClick={() => setUssdOpen(true)}
              className="flex min-h-10 items-center gap-2 rounded-md px-3 text-left text-xs text-mute hover:text-ink"
            >
              <Smartphone className="size-3.5" />
              Dial *919#
            </button>
            <button
              type="button"
              onClick={() => setWaOpen(true)}
              className="flex min-h-10 items-center gap-2 rounded-md px-3 text-left text-xs text-mute hover:text-ink"
            >
              <MessageCircle className="size-3.5" />
              WhatsApp intake
            </button>
          </div>
        </nav>
        <main className="px-4 py-5 sm:px-6 sm:py-6">
          {viewId === "admin-overview" && <AdminOverview />}
          {viewId === "admin-fleet" && <FleetView />}
          {viewId === "admin-hospitals" && <HospitalsView />}
          {viewId === "admin-directory" && <NationalDirectoryView />}
          {viewId === "admin-analytics" && <AnalyticsView />}
          {viewId === "admin-accounts" && <AdminAccountsView />}
          {viewId === "callintegration" && <CallIntegrationView />}
          {viewId === "public-report" && <PublicReportView />}
          {viewId === "emt-assignments" && <EmtAssignmentsView />}
          {viewId === "emt-registry" && <EmtRegistryView />}
          {viewId === "ems-unit" && <EmsConsoleView />}
          {viewId === "dispatch-console" && <DispatchQueueView />}
          {viewId === "dispatch-callcentre" && <CallCentreView />}
          {viewId === "dispatch-map" && <DispatchMapView />}
        </main>
      </div>
      <IncidentPanel />
    </div>
  );
}
