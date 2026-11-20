# MucNav — Munich Multi-Stop Navigation

A free, open-source navigation web app built specifically for **Munich & the MVV transit region**.

Unlike Google Maps, **MucNav lets you add unlimited intermediate stops across EVERY transport mode — including Public Transport (U-Bahn, S-Bahn, Tram, Bus & Regional trains)** — with configurable stay/dwell times at each stop so downstream departures chain together automatically.

## Features

- **4 Multi-Stop Transport Modes:** Public Transport (MVV), Walking, Cycling, and Driving.
- **Chained Public Transport with Stay Durations:** Set how long you want to stay at each intermediate stop (e.g., *20 min at Olympiapark*) and MucNav automatically computes live follow-up departures. Switching an alternative connection on Leg 1 automatically re-chains Legs 2+.
- **Authentic Munich MVV Experience:** Official MVV/MVG line colors & badges (U1–U8, S1–S8, Tram, MetroBus, ExpressBus, Regional), live delay indicators, platform numbers, mode filters, and **clickable MVV station pins with live departure boards**.
- **Standard & Hybrid Maps:** Instant toggle between **Standard** (Light/Dark vector maps) and **Hybrid** (high-resolution Satellite imagery with road & label overlays) powered by MapLibre GL JS.
- **Smart Stop Management:** Munich-biased search autocomplete (MVV stations + addresses + POIs), click-anywhere map pin dropping, browser GPS *"My Location"*, drag-and-drop stop reordering, reverse route, and one-click **"Optimize Stop Order"** (for Car, Bike & Foot).
- **Live Follow GPS Mode:** Track your blue dot along the active route with a live next-step banner and remaining distance.
- **Extras:** Shareable route URLs, saved favorites & recent searches (`localStorage`), bilingual UI (`EN / DE`), Dark/Light theme, mobile bottom sheet, and PWA support.

## Free Architecture (Zero Keys Required to Start!)

All external APIs are proxied cleanly through Next.js Route Handlers (`/api/*`) on Vercel:

| Capability | Primary (Optional Free Key) | Automatic Zero-Key Fallback |
| :--- | :--- | :--- |
| **Maps (Standard & Hybrid)** | MapTiler Free Tier (`NEXT_PUBLIC_MAPTILER_KEY`) | OpenFreeMap Vector + Esri World Imagery Hybrid |
| **MVV Public Transport & Live Departures** | [Transitous / MOTIS](https://transitous.org/) (Free GTFS + GTFS-RT) | — |
| **Car / Bike / Foot & Stop Optimization** | OpenRouteService Free Tier (`ORS_API_KEY`) | FOSSGIS Valhalla (`valhalla1.openstreetmap.de`) |
| **Munich Geocoding & Search** | Photon (OSM) + Transitous Station Geocode | — |

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It works immediately without any API keys!

*(Optional)* Copy `.env.example` to `.env.local` and add free keys from [MapTiler](https://cloud.maptiler.com/) and/or [OpenRouteService](https://openrouteservice.org/) for higher rate limits and MapTiler's Streets/Hybrid styles.

## Deploy to GitHub & Vercel (Free)

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: MucNav Munich Multi-Stop Navigation"
   git branch -M main
   git remote add origin https://github.com/<your-username>/munich-nav.git
   git push -u origin main
   ```
2. Go to [vercel.com/new](https://vercel.com/new) and import your `munich-nav` GitHub repository.
3. *(Optional)* Add `NEXT_PUBLIC_MAPTILER_KEY` and `ORS_API_KEY` under **Project Settings → Environment Variables**.
4. Click **Deploy** — Vercel handles both the frontend and `/api/*` serverless routes automatically on the free Hobby plan.
