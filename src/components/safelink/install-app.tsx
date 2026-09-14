import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && Boolean(window.navigator.standalone));
    setIsInstalled(standalone);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (isInstalled || dismissed || !installEvent) return null;

  async function install() {
    await installEvent?.prompt();
    const choice = await installEvent?.userChoice;
    if (choice?.outcome === "accepted") setIsInstalled(true);
    setInstallEvent(null);
  }

  return (
    <aside className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-lg border border-amber/40 bg-panel p-3 text-ink shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-amber/15 p-2 text-amber"><Download className="size-4" aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install SafeLink</p>
          <p className="mt-0.5 text-xs text-mute">Add the emergency response app to your phone home screen for faster access.</p>
          <Button type="button" size="sm" className="mt-2" onClick={() => void install()}>Install app</Button>
        </div>
        <button type="button" aria-label="Dismiss install prompt" className="rounded p-1 text-mute hover:text-ink" onClick={() => setDismissed(true)}><X className="size-4" aria-hidden="true" /></button>
      </div>
    </aside>
  );
}
