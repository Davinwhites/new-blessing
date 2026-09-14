import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { USSD_TYPES } from "@/lib/safelink/constants";
import { matchLocation } from "@/lib/safelink/engine";
import { useOps } from "@/lib/safelink/store";
import { Mark } from "./mark";

type Step = "root" | "type" | "location" | "casualties" | "statusRef";
type Bubble = { who: "bot" | "user"; text: string };

const ROOT_QUICK = [
  "Report an emergency",
  "Check report status",
  "Nearby hospitals",
  "About SafeLink",
];

export function WhatsAppOverlay() {
  const open = useOps((s) => s.waOpen);
  const setOpen = useOps((s) => s.setWaOpen);
  const fileReport = useOps((s) => s.fileReport);
  const [step, setStep] = useState<Step>("root");
  const [type, setType] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [quick, setQuick] = useState<string[]>(ROOT_QUICK);
  const [value, setValue] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  function bot(text: string) {
    setMessages((m) => [...m, { who: "bot", text }]);
  }
  function user(text: string) {
    setMessages((m) => [...m, { who: "user", text }]);
  }

  function reset() {
    setStep("root");
    setType(null);
    setLocation(null);
    setMessages([]);
    setQuick(ROOT_QUICK);
    setTimeout(() => {
      setMessages([
        {
          who: "bot",
          text: "Hi, I'm the SafeLink Uganda assistant. How can I help?",
        },
      ]);
    }, 0);
  }

  useEffect(() => {
    if (open) reset();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [messages]);

  async function process(raw: string) {
    const val = raw.trim();
    const lower = val.toLowerCase();
    const TYPES = [...USSD_TYPES];

    if (step === "root") {
      if (lower.includes("report") || val === "1") {
        setStep("type");
        bot("What type of emergency is it?");
        setQuick(TYPES);
      } else if (lower.includes("status") || val === "2") {
        setStep("statusRef");
        setQuick([]);
        bot("Sure — what's your report reference number? (e.g. INC-1050)");
      } else if (lower.includes("hospital") || val === "3") {
        const hospitals = useOps.getState().hospitals;
        const names = hospitals
          .filter((h) => (h.country || "Uganda") === "Uganda")
          .slice(0, 5)
          .map((h) => "• " + h.name)
          .join("\n");
        bot("Here are nearby major hospitals:\n" + names);
        setQuick(["Report an emergency", "Check report status"]);
      } else if (lower.includes("about") || val === "4") {
        bot(
          "SafeLink Uganda connects the public, EMTs, ambulances, police and hospitals for faster emergency response — reachable by app, USSD (*919#), voice (919) or WhatsApp.",
        );
        setQuick([
          "Report an emergency",
          "Check report status",
          "Nearby hospitals",
        ]);
      } else {
        bot(
          'Sorry, I didn\'t catch that. Tap an option below, or type "report", "status", or "hospital".',
        );
        setQuick(ROOT_QUICK);
      }
    } else if (step === "type") {
      const match =
        TYPES.find((t) => t.toLowerCase() === lower) ||
        TYPES.find((t) => lower.includes(t.split(" ")[0].toLowerCase()));
      if (match) {
        setType(match);
        setStep("location");
        setQuick([]);
        bot("Got it — " + match + ". Where is this happening? (nearest town or landmark)");
      } else {
        bot("Please choose one of the options below.");
        setQuick(TYPES);
      }
    } else if (step === "location") {
      setLocation(val);
      setStep("casualties");
      bot("Thanks. About how many people are injured or affected? (enter a number)");
    } else if (step === "casualties") {
      const n = parseInt(val, 10) || 1;
      const match = matchLocation((location || "").toLowerCase());
      const inc = await fileReport({
        type: type || "Other",
        location: match.name + ' (caller said: "' + location + '")',
        region: match.region,
        country: "Uganda",
        lat: match.lat,
        lng: match.lng,
        casualties: n,
        desc:
          'Reported via WhatsApp chatbot — free-text location as typed by the caller: "' +
          location +
          '".',
        source: "WhatsApp Chatbot",
        reporter: "WhatsApp user",
        channel: "WhatsApp",
        from: "WhatsApp chat session",
      });
      const etaMsg = inc.assigned.length
        ? `${inc.assigned.length} unit(s) dispatched — nearest ETA ${inc.assigned[0].eta} min.`
        : "Searching for the nearest available unit.";
      bot(
        `Report received. Ref: ${inc.id}\n${etaMsg}\nStay on this chat — I'll keep you posted.`,
      );
      setQuick(["Check report status"]);
      setStep("root");
    } else if (step === "statusRef") {
      const inc = useOps
        .getState()
        .incidents.find((i) => i.id.toLowerCase() === lower.trim());
      if (inc) {
        bot(
          `Status for ${inc.id}: ${inc.status.toUpperCase()}\nUnits assigned: ${inc.assigned.length}`,
        );
      } else {
        bot(
          `I couldn't find a report with reference "${val}". Please check the reference and try again.`,
        );
      }
      setQuick(["Report an emergency"]);
      setStep("root");
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
      <div className="flex h-[min(560px,90dvh)] w-full max-w-[340px] flex-col overflow-hidden rounded-2xl bg-[#e5ddd5] shadow-[var(--shadow-elevated)]">
        <div className="flex items-center gap-2.5 bg-wa-green px-3.5 py-3 text-white">
          <Mark className="h-8 w-auto" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">SafeLink Uganda</div>
            <div className="text-[0.6875rem] text-white/80">online · typically replies instantly</div>
          </div>
          <button
            type="button"
            className="flex size-11 items-center justify-center text-lg text-white"
            onClick={() => setOpen(false)}
            aria-label="Close WhatsApp"
          >
            ×
          </button>
        </div>
        <div
          ref={scroller}
          className="flex flex-1 flex-col gap-2 overflow-y-auto p-3"
          style={{
            background:
              "linear-gradient(rgba(230,221,212,0.92), rgba(230,221,212,0.92))",
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.who === "bot"
                  ? "max-w-[80%] self-start whitespace-pre-wrap rounded-lg rounded-tl-none bg-white px-2.5 py-2 text-sm leading-relaxed text-[#111]"
                  : "max-w-[80%] self-end whitespace-pre-wrap rounded-lg rounded-tr-none bg-wa-bubble px-2.5 py-2 text-sm leading-relaxed text-[#111]"
              }
            >
              {m.text}
            </div>
          ))}
        </div>
        {quick.length > 0 && (
          <div className="flex flex-wrap gap-1.5 bg-[#efe9e2] px-3 py-2">
            {quick.map((q) => (
              <button
                key={q}
                type="button"
                className="min-h-9 rounded-full border border-[#25D366] bg-white px-3 py-1.5 text-xs text-wa-green hover:bg-[#e9fce9]"
                onClick={() => {
                  user(q);
                  process(q);
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex gap-2 border-t border-[#ddd] bg-[#f0f0f0] px-3 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            const v = value.trim();
            if (!v) return;
            setValue("");
            user(v);
            process(v);
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type a message..."
            className="h-11 flex-1 rounded-full border border-[#ccc] bg-white px-3.5 text-sm text-[#111]"
          />
          <button
            type="submit"
            className="flex size-11 items-center justify-center rounded-full bg-[#25D366] text-white"
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
