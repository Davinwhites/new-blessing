import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { LoginScreen } from "@/components/safelink/login-screen";
import { AppShell } from "@/components/safelink/shell";
import { UssdOverlay } from "@/components/safelink/ussd";
import { WhatsAppOverlay } from "@/components/safelink/whatsapp";
import { Wordmark } from "@/components/safelink/mark";
import { useOps } from "@/lib/safelink/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const session = useOps((s) => s.session);
  const hydrated = useOps((s) => s.hydrated);
  const hydrate = useOps((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <>
      {session && !hydrated ? (
        <div className="grid min-h-dvh place-items-center bg-navy text-ink">
          <div className="flex flex-col items-center gap-3">
            <Wordmark />
            <p className="text-sm text-mute">Restoring your console…</p>
          </div>
        </div>
      ) : session ? (
        <AppShell />
      ) : (
        <LoginScreen />
      )}
      <UssdOverlay />
      <WhatsAppOverlay />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          className: "font-sans",
          style: {
            background: "var(--color-panel)",
            border: "1px solid var(--color-line)",
            color: "var(--color-ink)",
          },
        }}
      />
    </>
  );
}
