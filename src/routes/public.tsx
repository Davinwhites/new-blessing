import { useEffect } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PublicReportView } from "@/components/safelink/views-ops";
import { Wordmark } from "@/components/safelink/mark";
import { useOps } from "@/lib/safelink/store";

export const Route = createFileRoute("/public")({ component: PublicEmergencyPage });

export function PublicEmergencyPage() {
  const hydrated = useOps((state) => state.hydrated);
  const hydrate = useOps((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <div className="grid min-h-dvh place-items-center bg-navy"><Wordmark /></div>;
  }

  return (
    <main className="min-h-dvh bg-navy px-4 py-5 text-ink sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between border-b border-line pb-4">
        <Wordmark />
        <Link to="/staff" className="rounded-lg border border-line px-3 py-2 text-xs text-mute transition hover:border-amber hover:text-ink">
          Staff sign in
        </Link>
      </header>
      <section className="mx-auto max-w-5xl py-8 sm:py-12">
        <div className="mb-6 max-w-2xl">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-amber">Public emergency access</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Tell SafeLink what is happening.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-mute">No username or password is required. Share the emergency details and the response team will receive it in the national queue.</p>
        </div>
        <PublicReportView />
      </section>
    </main>
  );
}
