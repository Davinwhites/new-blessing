import { useState } from "react";
import {
  Ambulance,
  Headset,
  HeartPulse,
  MessageCircle,
  Phone,
  Shield,
  Smartphone,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_USER, OPERATOR_PASSWORD, ROLE_BLURB, ROLE_TITLES } from "@/lib/safelink/constants";
import { useOps } from "@/lib/safelink/store";
import type { Role } from "@/lib/safelink/types";
import { cn } from "@/lib/utils";
import { Mark } from "./mark";

const ROLES: { id: Role; icon: typeof Shield }[] = [
  { id: "admin", icon: Shield },
  { id: "dispatcher", icon: Headset },
  { id: "ems", icon: Ambulance },
  { id: "emt", icon: HeartPulse },
  { id: "public", icon: UserRound },
];

export function LoginScreen() {
  const login = useOps((s) => s.login);
  const setUssdOpen = useOps((s) => s.setUssdOpen);
  const setWaOpen = useOps((s) => s.setWaOpen);
  const [role, setRole] = useState<Role>("dispatcher");
  const [user, setUser] = useState(DEFAULT_USER.dispatcher);
  const [pass, setPass] = useState(OPERATOR_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="flag-stripe" />
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="enter-up grid w-full max-w-5xl overflow-hidden rounded-2xl bg-panel shadow-[var(--shadow-elevated)] md:grid-cols-[1.05fr_1fr]">
          <div className="relative border-b border-line bg-navy-2 px-6 py-8 md:border-b-0 md:border-r md:px-9 md:py-10">
            <div className="mb-6 flex items-center gap-3">
              <Mark className="h-14 w-auto" />
              <div>
                <div className="text-2xl font-semibold tracking-tight">SafeLink</div>
                <div className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-mute">
                  Uganda · National Dispatch
                </div>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-mute">
              National emergency dispatch for Uganda. Reports from *919#, WhatsApp
              and this console write to the live operations database. Units and
              hospitals are tracked on a real map of the country.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[
                ["25", "EMS units"],
                ["27", "Hospitals"],
                ["8", "EAC partners"],
              ].map(([n, l]) => (
                <div
                  key={l}
                  className="rounded-lg bg-panel px-3 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                >
                  <div className="font-mono text-lg font-semibold tabular-nums text-ink">{n}</div>
                  <div className="mt-0.5 text-[0.625rem] uppercase tracking-[0.08em] text-mute">
                    {l}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs text-ok">
              <span className="pulse-dot inline-block size-2 rounded-full bg-ok" />
              Gateways online · MTN · Airtel · Lyca · UTL
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setUssdOpen(true)}
              >
                <Smartphone className="size-4" />
                Dial *919#
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setWaOpen(true)}
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </Button>
            </div>
            <details className="mt-5 rounded-lg bg-panel-2 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
              <summary className="cursor-pointer text-sm font-medium text-ink">
                How the system operates
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-mute">
                A citizen reports via *919#, WhatsApp or this app. Auto-dispatch
                assigns the nearest ambulance and police, links a trauma hospital
                and writes the case to the database. Dispatchers verify, request
                backup and track units on OpenStreetMap. GPS positions update as
                units roll to scene.
              </p>
            </details>
          </div>
          <div className="flex flex-col justify-center px-6 py-8 md:px-9 md:py-10">
            <h2 className="m-0 text-lg font-semibold tracking-tight">Sign in to your console</h2>
            <p className="mt-1 mb-5 text-sm text-mute">
              Choose your console. Operator password is {OPERATOR_PASSWORD}.
            </p>
            <div className="mb-5 flex flex-col gap-1.5">
              {ROLES.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setRole(id);
                    setUser(DEFAULT_USER[id]);
                    setError(null);
                  }}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-[background-color,box-shadow] duration-150",
                    role === id
                      ? "bg-alert/10 shadow-[0_0_0_1px_rgba(230,57,70,0.55)]"
                      : "bg-panel-2 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.14)]",
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", role === id ? "text-alert" : "text-mute")} />
                  <span className="flex-1 text-sm text-ink">{ROLE_TITLES[id]}</span>
                  <span className="hidden text-xs text-mute sm:inline">{ROLE_BLURB[id]}</span>
                </button>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError(null);
                const err = await login(role, user, pass);
                setBusy(false);
                if (err) setError(err);
              }}
            >
              <div className="mb-3.5">
                <Label htmlFor="login-user">Username</Label>
                <Input
                  id="login-user"
                  value={user}
                  autoComplete="username"
                  onChange={(e) => setUser(e.target.value)}
                />
              </div>
              <div className="mb-3.5">
                <Label htmlFor="login-pass">Password</Label>
                <Input
                  id="login-pass"
                  type="password"
                  value={pass}
                  autoComplete="current-password"
                  onChange={(e) => setPass(e.target.value)}
                />
              </div>
              {error && (
                <p className="mb-3 text-sm text-alert">{error}</p>
              )}
  <Button type="submit" className="mt-1 w-full font-semibold" disabled={busy}>
  {busy ? "Signing in…" : "Sign in"}
  </Button>
  <Link to="/public" className="mt-3 block text-center text-xs text-mute underline-offset-4 transition hover:text-amber hover:underline">
  Public emergency report — no sign in required
  </Link>
            </form>
            <p className="mt-4 text-center text-xs text-mute">
              All incidents, units and hospitals persist in the operations
              database. Public reports do not require a dispatcher login —
              use *919# or WhatsApp from this screen.
            </p>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-mute">
              <Phone className="size-3" />
              919 · *919# · 0800 191 911
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
