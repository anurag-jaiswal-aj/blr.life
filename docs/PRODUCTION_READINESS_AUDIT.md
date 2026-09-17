# PRODUCTION READINESS & ZERO-COST DEPLOYMENT AUDIT

## 1. Current Production Architecture
*Evidence: `docs/DEPLOYMENT.md`*
The intended production architecture explicitly targets a **₹0/month** distributed stack:
- **Frontend**: Vercel (Next.js)
- **Backend**: Render Web Service (FastAPI Docker container)
- **Database**: Neon (PostgreSQL + PostGIS)
- **Backups**: GitHub Actions (Cron)

## 2. Verified Infrastructure
- **GitHub Actions**: Neon backup is verified working, correctly pulls `pg_dump` via `postgresql-client-18`, and retains for 14 days.
- **Docker**: `docker-compose.prod.yml` and `apps/api/Dockerfile` are verified correct. The API builds into a slim, stateless, non-root user image binding to `0.0.0.0:${PORT}`.

## 3. Frontend Deployment Requirements (Vercel)
*Evidence: `apps/web/package.json` and `apps/web/src/app/api/geocode/route.ts`*
- **Compatibility**: 100% compatible. Vercel automatically detects Next.js.
- **Server-side Behavior**: The Geocoding proxy (`route.ts`) acts as a serverless edge function pacing requests to Nominatim.
- **Environment Variables**: Requires `NEXT_PUBLIC_API_URL` and `NOMINATIM_USER_AGENT`.

## 4. Backend Deployment Requirements (Render)
*Evidence: `apps/api/Dockerfile` and `apps/api/app/core/config.py`*
- **Process Model**: Stateless HTTP server (`uvicorn`).
- **Dependencies**: No persistent filesystem required. No background workers (Celery/Redis are absent).
- **Compatibility**: 100% compatible with Render's Free Docker runtime or any CaaS (Container-as-a-Service) platform.
- **Cold Starts**: Render free tier sleeps after 15 mins (approx 45s cold start).

## 5. Database Requirements (Neon)
*Evidence: `apps/api/app/db/recommendation.py` and `alembic/versions/`*
- **Extensions**: Heavily relies on PostGIS (`ST_DistanceSphere`). Neon supports this.
- **Connection**: Requires `postgresql+asyncpg://` schema for the backend SQLAlchemy engine, and `postgresql://` schema for GitHub Actions `pg_dump`.

## 6. External Service Requirements (Map & Geocoding)
*Evidence: `apps/web/src/components/MapContainer.tsx` and `apps/web/src/app/api/geocode/route.ts`*
- **Geocoding**: OpenStreetMap Nominatim. *Verified*: The Next.js API route includes strict caching, pacing (1000ms), and custom User-Agent injection to comply with OSM usage policies.
- **Map Tiles**: Directly loading from `https://tile.openstreetmap.org/`. 
  - *Risk*: OSM Tile Usage Policy forbids heavy/commercial production use without prior permission. While it satisfies ₹0, high traffic will result in IP blocks.

## 7. Environment Variables
| Variable | Used By | Required in Production | Secret? | Purpose |
|---|---|---|---|---|
| `DATABASE_URL` | Backend / CI | YES | YES | Neon connection string |
| `ENVIRONMENT` | Backend | YES | NO | Set to `production` |
| `CORS_ORIGINS` | Backend | YES | NO | Restrict API to Vercel domain |
| `TRUSTED_HOSTS` | Backend | YES | NO | Restrict Host headers |
| `FORWARDED_ALLOW_IPS` | Backend | YES | NO | Trust Render's proxy |
| `NEXT_PUBLIC_API_URL` | Frontend | YES | NO | Point Next.js to Render URL |
| `NOMINATIM_USER_AGENT`| Frontend | YES | NO | Identify to OSM Nominatim |

## 8. Security Findings
- **SQL Injection**: Safely parameterized via SQLAlchemy.
- **CORS**: Explicitly configurable via `CORS_ORIGINS` in `config.py`.
- **Rate Limiting**: `RATE_LIMIT_PER_MINUTE` is implemented in config (default 10).
- **Secrets**: `.env.example` is clean. No secrets are committed.

## 9. Data Readiness
*Evidence: Local DB state verified in previous audit.*
- **Coverage**: 37 localities and 65 metro stations.
- **Missing Data**: Handled elegantly. Distance and amenity math works beautifully.
- **Affordability**: Missing, but explicitly hidden in the UI (`{false && ...}` in `ControlsPanel.tsx`). The product is honest.

## 10. Failure-Mode Analysis
- **Backend Unavailable**: Frontend fails gracefully.
- **Database Sleeps (Neon)**: Neon wakes in ~500ms. The API will await the connection.
- **Map Provider Blocked**: Tiles will fail to load, showing a blank background behind markers.
- **Geocoding Unavailable**: The Next.js proxy returns `502`, preventing search.

## 11. ₹0 Cost Analysis
| Component | Current | Required for V1 | Free option | Limit/Risk | Decision |
|---|---|---|---|---|---|
| **Frontend** | Vercel | Yes | Vercel Free | Bandwidth caps | KEEP |
| **Backend** | Render | Yes | Render Free | 15m sleep (cold starts) | KEEP |
| **Database** | Neon | Yes | Neon Free | 5m sleep | KEEP |
| **Backups** | GH Actions | Yes | GitHub Free | Action minutes | KEEP |
| **Maps** | OSM Tiles | Yes | OSM | Terms of Service violation if high traffic | RISK |

## 12. VPS Necessity Determination
**A VPS IS ABSOLUTELY NOT REQUIRED.**
The backend is a lightweight, stateless, asynchronous Python API. It requires no persistent disk, no long-running queue workers, and no WebSockets. The documented Render (Docker) + Vercel + Neon architecture is technically sound, highly modern, and perfectly suited to a ₹0 serverless/CaaS deployment.

## 13. Recommended Production Architecture
**VERIFIED CURRENT PLAN:**
- **Frontend**: Vercel
- **Backend**: Render (Web Service - Docker)
- **Database**: Neon (Postgres 18 + PostGIS)
- **Domain**: Cloudflare (for free DNS/Proxy) pointing to Vercel/Render.

## 14. Pre-launch Blockers
### MUST FIX BEFORE PUBLIC V1
*There are no code blockers. All blockers are purely operational.*
1. Create Render, Vercel, and Neon accounts.
2. Inject exact Environment Variables into platforms.

### SHOULD FIX BEFORE PUBLIC V1
1. **Map Tile Provider**: Switch `MapContainer.tsx` from raw OSM tiles to a generous free-tier provider (e.g., Stadia Maps, MapTiler, or Mapbox) to avoid violating OSM's strict non-commercial/high-traffic policies.

### CAN WAIT UNTIL AFTER LAUNCH
1. Data Ingestion pipeline for Rent Affordability (V2).
2. OSRM routing implementation for real traffic times (V2).

## 15. Exact Next Implementation Phase
**Phase E — Production Deployment & Launch**

## 16. Deployment Sequence
1. Provision Neon Database -> Run Alembic -> Bootstrap data.
2. Provision Render Docker Service -> Link to Neon.
3. Provision Vercel Next.js Project -> Link to Render API.
4. Finalize Custom Domains.
