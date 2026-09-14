import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { LoginScreen } from "@/components/safelink/login-screen";
import { AppShell } from "@/components/safelink/shell";
import { UssdOverlay } from "@/components/safelink/ussd";
import { WhatsAppOverlay } from "@/components/safelink/whatsapp";
import { Wordmark } from "@/components/safelink/mark";
import { useOps } from "@/lib/safelink/store";

export const Route = createFileRoute("/staff")({ component: StaffPage });

function StaffPage() {
  const session = useOps((s) => s.session);
  const hydrated = useOps((s) => s.hydrated);
  const hydrate = useOps((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <div className="grid min-h-dvh place-items-center bg-navy text-ink"><Wordmark /></div>;
  }

  return (
    <>
      {session ? <AppShell /> : <LoginScreen />}
      <UssdOverlay />
      <WhatsAppOverlay />
      <Toaster theme="dark" position="bottom-right" />
    </>
  );
}
