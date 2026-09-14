# SafeLink Uganda

National emergency response and dispatch platform for Uganda.

SafeLink takes reports from **\*919#**, **WhatsApp**, the **public app**, and the **919 voice line**, then auto-dispatches the nearest ambulance, police and (when needed) fire unit, links a trauma hospital, and tracks the case on a live map of the country.

This repository is published as **[new-blessing](https://github.com/Davinwhites/new-blessing)**.

## What you can do

- **Public** — file an emergency from the app, USSD keypad, or WhatsApp chatbot
- **Dispatcher** — national call queue, live OpenStreetMap, verify reports, request backup
- **EMS / EMT** — unit console, on-scene status, patient intake
- **Admin** — fleet, hospital network, EMT registry, analytics

## Demo consoles

Password for every operator: `SafeLink.919`

| Role | Username |
| --- | --- |
| Dispatcher | `dispatcher.mukono` |
| Admin | `admin.kampala` |
| EMS responder | `ambulance.amb01` |
| EMT | `emt.namutebi` |
| Public user | `citizen.elisha` |

You can also report without signing in — use **Dial \*919#** or **WhatsApp** on the login screen.

## Run locally

```bash
npm install
npm run dev
```

The app listens on port 8080. With no `DATABASE_URL` it uses an embedded Postgres (PGLite) so the preview always works. On deploy, set `DATABASE_URL` to a Postgres instance; schema lives in `migrations/0002_safelink.sql`.

## Stack

- React 19 + TanStack Start
- Tailwind CSS v4
- Postgres / PGLite
- Leaflet + OpenStreetMap (Carto dark tiles)

## Emergency numbers (proposed)

- **919** — direct voice
- **\*919#** — USSD
- **0800 191 911** — toll-free backup
- **+256 919 000 001** — WhatsApp
