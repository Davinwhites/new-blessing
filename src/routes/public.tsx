import { useMemo, useState, useEffect } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PublicReportView } from "@/components/safelink/views-ops";
import { WhatsAppOverlay } from "@/components/safelink/whatsapp";
import { Wordmark } from "@/components/safelink/mark";
import { useOps } from "@/lib/safelink/store";

export const Route = createFileRoute("/public")({ component: PublicEmergencyPage });

export function PublicEmergencyPage() {
  const hydrated = useOps((state) => state.hydrated);
  const hydrate = useOps((state) => state.hydrate);
  const setWaOpen = useOps((state) => state.setWaOpen);

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
        <ProviderDirectory onOpenChat={() => setWaOpen(true)} />
      </section>
      <WhatsAppOverlay />
    </main>
  );
}

function ProviderDirectory({ onOpenChat }: { onOpenChat: () => void }) {
  const hospitals = useOps((state) => state.hospitals);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All regions");
  const regions = useMemo(() => ["All regions", ...Array.from(new Set(hospitals.map((hospital) => hospital.region).filter(Boolean))).sort()], [hospitals]);
  const listings = useMemo(() => {
    const term = query.trim().toLowerCase();
    return hospitals.filter((hospital) => {
      const searchable = [hospital.name, hospital.facilityType, hospital.region, hospital.district, hospital.subcounty, hospital.services, hospital.phone].join(" ").toLowerCase();
      return hospital.verificationStatus === "official" && (region === "All regions" || hospital.region === region) && (!term || searchable.includes(term));
    });
  }, [hospitals, query, region]);

  return (
    <section className="mt-10 border-t border-line pt-8" aria-labelledby="provider-directory-title">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-amber">Verified community directory</p>
          <h2 id="provider-directory-title" className="text-2xl font-semibold tracking-tight">Find help near you</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-mute">Browse verified health and emergency providers by region. Contact providers directly for availability before travelling.</p>
        </div>
        <button type="button" onClick={onOpenChat} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ok px-4 py-2 text-sm font-semibold text-navy transition hover:brightness-110">Chat on WhatsApp</button>
      </div>
      <div className="mb-5 grid gap-3 rounded-xl border border-line bg-panel-2 p-3 sm:grid-cols-[1fr_220px]">
        <label className="sr-only" htmlFor="provider-search">Search providers</label>
        <input id="provider-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search provider, service, district, or phone" className="min-h-11 rounded-lg border border-line bg-navy px-3 text-sm text-ink outline-none placeholder:text-mute focus:border-amber" />
        <label className="sr-only" htmlFor="provider-region">Filter by region</label>
        <select id="provider-region" value={region} onChange={(event) => setRegion(event.target.value)} className="min-h-11 rounded-lg border border-line bg-navy px-3 text-sm text-ink outline-none focus:border-amber">{regions.map((item) => <option key={item}>{item}</option>)}</select>
      </div>
      {listings.length === 0 ? <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-mute">No verified providers match those filters. Try another region or search term.</div> : <div className="grid gap-3 md:grid-cols-2">{listings.map((provider) => <article key={provider.id} className="rounded-xl border border-line bg-panel-2 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{provider.name}</h3><p className="mt-1 text-xs text-amber">{provider.facilityType || "Emergency provider"} · {provider.region}</p></div><span className="rounded-full bg-ok/15 px-2 py-1 text-[10px] font-mono uppercase text-ok">Verified</span></div><p className="mt-3 text-sm text-mute">{provider.services || "Emergency and referral services"}</p><p className="mt-2 text-xs text-mute">{provider.district || provider.zone}{provider.address ? ` · ${provider.address}` : ""}</p><div className="mt-4 flex flex-wrap gap-2">{provider.phone && <a href={`tel:${provider.phone}`} className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink hover:border-amber">Call {provider.phone}</a>}{provider.whatsapp && <a href={`https://wa.me/${provider.whatsapp.replace(/\\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded-lg bg-ok px-3 py-2 text-xs font-semibold text-navy">WhatsApp</a>}</div></article>)}</div>}
    </section>
  );
}
