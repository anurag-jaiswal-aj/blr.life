# blr.life Map & Hosting Decision

## Current Architecture
- **Frontend**: Vercel Hobby
- **Backend**: Render Free Web Service (Docker FastAPI)
- **Database**: Neon Free (PostgreSQL 18 + PostGIS)
- **Map Provider**: OpenStreetMap (Standard Tiles)

## Actual V1 Requirements
The product requires extremely basic mapping capabilities:
- **Geographic Scope**: Exclusively Bengaluru.
- **Markers**: ~1 to 50 custom HTML markers (Work location + Recommendations).
- **Interactions**: Basic panning, zooming, and click-to-drop-pin.
- **Zoom Levels**: City to neighborhood scale (approx 10 to 15).
- **Features NOT Required**: Routing, live traffic, satellite imagery, directions, turn-by-turn.
- **Geocoding**: Yes (Currently implemented via a FastAPI proxy to Nominatim (`/api/v1/geocode`), paced properly on the backend).

## Map Provider Comparison

| Provider | Free allowance | API key | Attribution | Commercial/public use | Usage limits | Overage risk | ₹0 V1 feasible |
|---|---|---|---|---|---|---|---|
| **OSM (Standard)** | None explicitly | No | Yes | **NO** | "Heavy use forbidden" | Domain/IP block | NO (Policy Block) |
| **Mapbox** | 50,000 loads/mo | Yes | Yes | YES | 50k web loads | Pay per unit / Uncapped | YES (Monitor usage) |
| **MapTiler** | 100,000 reqs/mo | Yes | Yes | **NO** | 100k requests | Hard limit (Suspend) | NO (Policy Block) |
| **Stadia Maps**| 200,000 credits/mo | Yes | Yes | **NO** | 200k credits | Hard limit (Suspend) | NO (Policy Block) |

*Note: While blr.life V1 has no revenue, a "public launch" is often interpreted as commercial intent by strict providers like MapTiler and Stadia. Mapbox explicitly allows commercial use on its free tier.*

## Backend Hosting Comparison
**Render Free**
- **Cold Start**: Spins down after 15 minutes of inactivity. Takes 45–60 seconds to wake up.
- **Limits**: 750 compute hours/month.
- **Docker Support**: Yes.
- **Commercial Use**: Yes.

**Koyeb Free**
- **Cold Start**: **NONE.** Free instances do not spin down.
- **Limits**: 1 Instance, 512MB RAM, 0.1 vCPU, 100GB Outbound Bandwidth.
- **Docker Support**: Yes (Native).
- **Commercial Use**: Yes (Though "not recommended for production" SLAs apply).

## Cost Analysis
All considered options maintain a strict **₹0/month** operating cost for V1 traffic levels.
- Vercel (Hobby): ₹0
- Neon (Free): ₹0
- Koyeb/Render (Free): ₹0
- Mapbox: ₹0 (up to 50k map loads)

## Provider Policy Constraints
1. **OSM**: Relying on OSM standard tiles for a public launch is a strict policy violation.
2. **Vercel Hobby**: Prohibits commercial monetization (ads, paywalls). Valid for V1 since V1 is a free experiment.

## UX / Cold Start Analysis
**Request Flow:** Browser → Next.js (Instant) → Backend API (??) → Neon (500ms delay if asleep) → Response.

If the backend is hosted on **Render Free**, the user will experience a **45 to 60-second hang** when submitting their first location constraint. Adding a "Waking up server..." UI state does not solve the fundamental problem that 45 seconds is an unacceptable wait time for a consumer web app, causing massive abandonment.

If the backend is hosted on **Koyeb Free**, the container stays awake 24/7. The only cold start is Neon (500ms), which is virtually imperceptible.

## Architecture Options

**Option A: Vercel + Render Free + Neon + Mapbox**
- **Cost**: ₹0
- **Cold Start**: 45s (Unacceptable UX)
- **Map Compliance**: Valid
- **Suitability**: Poor.

**Option B: Vercel + Koyeb Free + Neon + Mapbox**
- **Cost**: ₹0
- **Cold Start**: Negligible (500ms DB wake)
- **Map Compliance**: Valid
- **Suitability**: Excellent.

## Risks
1. **Mapbox Overages**: Mapbox does not hard-cap the free tier. If the app goes viral and exceeds 50,000 map loads in a month, billing occurs. (Usage must be monitored).
2. **Koyeb Deprecation**: Free tiers with no sleep (like Heroku and Fly.io previously offered) are historically subject to change or requiring credit cards.

## Decision
**READY FOR LIMITED PUBLIC V1** (Subject to Required Changes)

The architecture is fully viable at ₹0/month, provided we swap the map tile provider and select a non-sleeping free backend host to protect the User Experience.

## Required Changes
1. **Map Provider**: Modify `MapContainer.tsx` to use Mapbox GL JS (or MapLibre with Mapbox raster/vector tiles) using a Mapbox API key.
2. **Backend Host**: Deploy the FastAPI Docker container to Koyeb instead of Render.

## Exact Deployment Sequence
1. Create a Mapbox account, generate a public token, and integrate it into the frontend.
2. Provision Neon Free tier -> Run Alembic -> Bootstrap spatial data.
3. Deploy API Docker container to Koyeb Free.
4. Deploy Frontend to Vercel Hobby (injecting Koyeb API URL and Mapbox Token).
5. Map Cloudflare DNS to Vercel.

## Addendum: Final Current State
After further evaluation and implementation testing, the final architecture was pivoted away from Mapbox and Koyeb:
- **Map Provider**: OpenFreeMap is the current basemap provider. No Mapbox account, token, or endpoint is required.
- **Map Rendering**: MapLibre GL JS is used for rendering.
- **MapLibre Version Fix**: A critical map-rendering issue where vector tiles would not load in the browser was resolved by downgrading `maplibre-gl` from `v6.x` to `v4.7.1`. The issue was caused by a compatibility problem between MapLibre v6 web workers and the Next.js Turbopack integration in this application setup, not by OpenFreeMap itself. OpenFreeMap vector tiles and glyphs now load successfully.
- **Backend Hosting**: The FastAPI backend is deployed on Render, not Koyeb.
- **Frontend Hosting**: Vercel.
- **Database Hosting**: Neon PostgreSQL/PostGIS.
