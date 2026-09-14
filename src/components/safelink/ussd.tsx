import { useEffect, useRef, useState } from "react";
import { USSD_TYPES } from "@/lib/safelink/constants";
import { matchLocation } from "@/lib/safelink/engine";
import { useOps } from "@/lib/safelink/store";
import { Button } from "@/components/ui/button";

type Step = "root" | "type" | "location" | "casualties" | "statusRef";

export function UssdOverlay() {
  const open = useOps((s) => s.ussdOpen);
  const setOpen = useOps((s) => s.setUssdOpen);
  const fileReport = useOps((s) => s.fileReport);
  const incidents = useOps((s) => s.incidents);
  const [step, setStep] = useState<Step>("root");
  const [type, setType] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [screen, setScreen] = useState("");
  const [ended, setEnded] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function render(text: string, isEnded = false) {
    setScreen(text);
    setEnded(isEnded);
    setValue("");
  }

  function reset() {
    setStep("root");
    setType(null);
    setLocation(null);
    setEnded(false);
    render(
      "CON Welcome to SafeLink Uganda\n1. Report Emergency\n2. Check Report Status\n3. Nearby Hospitals\n4. About SafeLink\n\nReply with a number.",
    );
  }

  useEffect(() => {
    if (open) {
      reset();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  async function process(val: string) {
    if (step === "root") {
      if (val === "1") {
        setStep("type");
        render(
          "CON What type of emergency?\n1. Road Traffic Accident\n2. Rail Crossing Collision\n3. Medical Emergency\n4. Fire\n5. Other",
        );
      } else if (val === "2") {
        setStep("statusRef");
        render("CON Enter your report reference\n(e.g. INC-1050)");
      } else if (val === "3") {
        const hospitals = useOps.getState().hospitals;
        const names = hospitals
          .filter((h) => (h.country || "Uganda") === "Uganda")
          .slice(0, 5)
          .map((h, i) => i + 1 + ". " + h.name)
          .join("\n");
        render("END Nearest major hospitals:\n" + names, true);
      } else if (val === "4") {
        render(
          "END SafeLink Uganda connects the public, EMTs, ambulances, police and hospitals for faster emergency response.\n\nDial *919# anytime.\nToll-free: 0800 191 911.",
          true,
        );
      } else {
        render("END Invalid choice.\nDial *919# to try again.", true);
      }
    } else if (step === "type") {
      const idx = parseInt(val, 10);
      if (idx >= 1 && idx <= 5) {
        setType(USSD_TYPES[idx - 1]);
        setStep("location");
        render(
          "CON Enter your location\n(nearest town or landmark)\ne.g. Mukono Town Centre",
        );
      } else {
        render("END Invalid choice.\nDial *919# to try again.", true);
      }
    } else if (step === "location") {
      setLocation(val);
      setStep("casualties");
      render("CON How many people are injured or affected?\nEnter a number.");
    } else if (step === "casualties") {
      const n = parseInt(val, 10) || 1;
      const locText = (location || "").toLowerCase();
      const match = matchLocation(locText);
      const inc = await fileReport({
        type: type || "Other",
        location: match.name + ' (caller said: "' + location + '")',
        region: match.region,
        country: "Uganda",
        lat: match.lat,
        lng: match.lng,
        casualties: n,
        desc:
          'Reported via USSD *919# — free-text location as typed by the caller: "' +
          location +
          '".',
        source: "USSD *919#",
        reporter: "USSD caller (anonymous)",
        channel: "USSD",
        from: "*919# session",
        phone: "+256 7XX XXX XXX (USSD caller)",
      });
      render(
        "END Thank you. Your report has been received.\nRef: " +
          inc.id +
          "\nNearest ambulance has been notified.\nYou may receive an SMS update.",
        true,
      );
    } else if (step === "statusRef") {
      const inc = incidents.find(
        (i) => i.id.toLowerCase() === val.toLowerCase().trim(),
      );
      if (inc) {
        render(
          "END Status for " +
            inc.id +
            ":\n" +
            inc.status.toUpperCase() +
            "\nUnits assigned: " +
            inc.assigned.length,
          true,
        );
      } else {
        render('END No report found with reference "' + val + '".', true);
      }
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(6,12,20,0.78)] p-5 backdrop-blur-[3px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-[280px] overflow-hidden rounded-[28px] border-[8px] border-[#1c2a22] bg-[#0c1a12] shadow-[var(--shadow-elevated)]">
        <div className="flex justify-center py-2">
          <span className="h-1 w-12 rounded-full bg-[#2a4030]" />
        </div>
        <div className="flex items-center justify-between border-b border-[#1f3524] bg-[#132417] px-3 py-2 font-mono text-[0.6875rem] text-[#8FE0A8]">
          <span>SafeLink · *919#</span>
          <button
            type="button"
            className="min-h-8 px-1 text-sm text-[#8FE0A8]"
            onClick={() => setOpen(false)}
            aria-label="Close USSD"
          >
            ×
          </button>
        </div>
        <div className="min-h-[180px] bg-[#0a170e] px-3.5 py-4">
          <pre className="m-0 whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-[#6BE38A]">
            {screen}
          </pre>
        </div>
        {ended ? (
          <div className="flex gap-2 border-t border-[#1f3524] bg-[#0c1a12] p-3">
            <Button size="sm" onClick={reset}>
              Dial again
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form
            className="flex gap-2 border-t border-[#1f3524] bg-[#0c1a12] p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const v = value.trim();
              if (!v) return;
              process(v);
            }}
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Type reply"
              className="h-9 min-h-11 flex-1 rounded-md border border-[#244631] bg-[#0a170e] px-2.5 font-mono text-sm text-[#8FE0A8] focus-visible:outline-[#6BE38A]"
            />
            <Button size="sm" type="submit">
              Send
            </Button>
          </form>
        )}
        <div className="flex justify-center py-3">
          <span className="size-8 rounded-full border-2 border-[#2a4030]" />
        </div>
      </div>
    </div>
  );
}
