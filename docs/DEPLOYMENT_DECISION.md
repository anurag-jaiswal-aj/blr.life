# blr.life Deployment Decision

## Current Objective
Determine whether the proposed ₹0/month production architecture (Vercel + Render + Neon) is technically feasible, legally permitted by provider terms, and suitable for the public launch of the `blr.life` V1 MVP.

## Hard Constraints
- **Operating Cost**: Strictly ₹0/month.
- **V1 Scope**: Public launch, but currently operates strictly as a free, non-commercial experiment. There is no revenue, no ads, and no B2B APIs in V1.
- **User Experience**: The app must function reliably, though minor cold-start delays are acceptable for a free MVP.

## Current Architecture
- **Frontend**: Vercel Hobby (Next.js)
- **Backend**: Render Free Web Service (FastAPI Docker container)
- **Database**: Neon Free Tier (PostgreSQL + PostGIS)
- **Backups**: GitHub Actions -> custom workflow dumping from Neon
- **Maps**: OpenStreetMap standard tile server (`https://tile.openstreetmap.org/`)

## Provider Constraints

| Provider | Free Tier | Production Allowed? | Commercial Allowed? | Important Limits | Risk |
|---|---|---|---|---|---|
| **Vercel** | Hobby | Yes (Non-commercial) | **NO** | 100GB bandwidth/mo. | Violation if monetized in the future. |
| **Render** | Free | Yes | Yes | 15 min sleep, 750 hrs/mo | 45-60s cold starts severely impact UX. |
| **Neon** | Free | Yes | Yes | 5 min sleep, 0.5GB storage | Very fast wake (<1s). Storage cap limits heavy data ingestion. |
| **GitHub** | Free | Yes | Yes | 2,000 mins/mo (Private) | Negligible for a daily backup script. |
| **OSM Tiles** | N/A | **NO** | **NO** | "Heavy use is forbidden" | High risk of IP/domain ban if public launch gains any traction. |

## Map/OSM Assessment
- **Implementation**: `MapContainer.tsx` directly requests `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
- **Policy Compliance**: **POTENTIAL ISSUE / NON-COMPLIANT**. The OpenStreetMap Foundation explicitly forbids distributing apps that default to their tile servers for anything beyond testing or extremely light use. A public launch of `blr.life` invites unpredictable traffic.
- **Result**: We cannot use the standard OSM tile server for a public launch.

## Zero-Cost Assessment
- **₹0 for Development**: Fully viable.
- **₹0 for Private Demo**: Fully viable.
- **₹0 for Public V1 (Non-commercial)**: Viable, *except* for the OSM tile server. The Render cold-start (45s) is a severe UX penalty but technically functional.
- **₹0 for Production SaaS (Monetized)**: **IMPOSSIBLE**. Vercel Hobby strictly prohibits commercial use. Render's sleeping architecture cannot support professional SLAs.

## Option Comparison

**Option A: Current Distributed (Vercel + Render + Neon)**
- **Cost**: ₹0.
- **Complexity**: Low (fully managed).
- **UX Limitation**: First user after 15 mins of inactivity waits ~45s for Render to wake up.
- **Compliance**: Fails on OSM tiles. Vercel compliance relies entirely on remaining non-commercial.

**Option B: Oracle Cloud Always Free VPS (Self-Hosted)**
- **Cost**: ₹0 (Oracle provides a permanent 24GB RAM / 4 OCPU ARM server).
- **Complexity**: High (Requires manual OS patching, Docker Compose orchestration, Caddy/Nginx reverse proxy, manual TLS, script-based backups).
- **UX Limitation**: None. No cold starts, 100% uptime.
- **Compliance**: Full ownership. Commercial use fully permitted.

## Risks
1. **OSM Tile Block**: Launching with standard OSM tiles risks an immediate ban on the `blr.life` domain by OSM sysadmins.
2. **Render Cold Start Abandonment**: Users landing on the site may assume it is broken if the API takes 45 seconds to return the first recommendation.

## What We Can Launch Now
We can launch a **Private Demo** immediately on the current architecture. 

## What Must Change Before Public Launch
1. **Maps**: We must replace the OSM tile URL in `MapContainer.tsx` with a generous free-tier provider that permits public/commercial use (e.g., Mapbox, Stadia Maps, or MapTiler).
2. **Cold Start UX**: The frontend must explicitly communicate "Waking up servers, this may take a minute..." if the API request exceeds 5 seconds.

## What Can Wait Until V2
1. **Commercial Hosting Migration**: If the app introduces monetization or B2B features, we must migrate off Vercel Hobby to Vercel Pro (paid) or a self-hosted VPS (Oracle Free / Hetzner).
2. **Rent Ingestion**: Data pipelines to support the currently dormant affordability controls.

## Final Deployment Decision
**BLOCKED — PROVIDER/POLICY**

## Exact Deployment Sequence
*(Once the Map provider blocker is resolved)*
1. Create free tier account on Mapbox/Stadia Maps and swap the URL in `MapContainer.tsx`.
2. Provision Neon Free tier -> Run Alembic -> Bootstrap spatial data.
3. Deploy API to Render Free.
4. Deploy Frontend to Vercel Hobby (injecting API URL and Map API Key).
5. Map Cloudflare DNS to Vercel.
