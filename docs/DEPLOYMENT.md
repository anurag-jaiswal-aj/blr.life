# blr.life V1 Zero-Cost Deployment Guide

This guide documents the production deployment architecture for blr.life V1.
The infrastructure is designed to cost **₹0/month** by leveraging free tiers from Vercel, Render, and Neon.

## Architecture Overview

```text
      [ User Browser ]
             |
             |  (HTTPS / Vercel Edge)
             v
   [ Vercel Next.js ] ---> (Geocode proxy) ---> [ OSM Nominatim ]
             |
             |  (HTTPS / api.blr.life)
             v
 [ Render FastAPI (Docker) ]
             |
             |  (PostgreSQL TCP/IP)
             v
 [ Neon PostgreSQL + PostGIS ]
```

## 1. Neon Setup (Database)
1. Create a free account at [Neon.tech](https://neon.tech).
2. Create a new project (e.g., `blrlife-v1`).
3. Note the connection string (e.g., `postgres://[user]:[password]@[host]/[dbname]?sslmode=require`).

## 2. PostGIS Enablement & Verification
Neon supports PostGIS. Before migrating:
1. Connect to the Neon database using a SQL client.
2. Run: `CREATE EXTENSION IF NOT EXISTS postgis;`
3. Verify: `SELECT PostGIS_Version();`

## 3. DATABASE_URL Configuration
Construct the SQLAlchemy-compatible async URL:
- Original: `postgres://...`
- Required: `postgresql+asyncpg://[user]:[password]@[host]/[dbname]?sslmode=require`

## 4. Alembic Migration
Migrations must be run manually or via CI against the Neon database.
*Do not run migrations from a Vercel build step.*
1. Set `DATABASE_URL` in your local `.env`.
2. Run `make migrate` locally to upgrade the Neon database to head.

## 5. Production Bootstrap
Bootstrap the V1 data into Neon:
1. Set `DATABASE_URL` in your local `.env`.
2. Run `make bootstrap` locally to ingest the curated JSON data into the production database.

## 6. Render Backend Configuration (API)
1. Create a **New Web Service** on [Render](https://render.com).
2. Connect the GitHub repository.
3. Select **Docker** as the runtime.
4. Set the Root Directory to `apps/api` (if applicable) or Dockerfile path `apps/api/Dockerfile`.
5. Add Environment Variables:
   - `ENVIRONMENT` = `production`
   - `DATABASE_URL` = (The async Neon URL)
   - `CORS_ORIGINS` = `["https://blr.life", "https://www.blr.life"]`
   - `TRUSTED_HOSTS` = `["api.blr.life", "blr-life-api.onrender.com"]`
   - `FORWARDED_ALLOW_IPS` = `*` (Render proxy)
6. Note: Free tier instances sleep after 15 minutes of inactivity, causing 30-60s cold starts.

## 7. Vercel Frontend Configuration (Next.js)
1. Create a new Project on [Vercel](https://vercel.com).
2. Select **Next.js** framework.
3. Set the Root Directory to `apps/web`.
4. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://api.blr.life` (or the Render `.onrender.com` URL)
   - `NOMINATIM_USER_AGENT` = `blr.life/1.0 (contact@your-email.com)`

## 8. Nominatim Identification Configuration
OpenStreetMap policy requires a valid `User-Agent`.
Configure the `NOMINATIM_USER_AGENT` environment variable in Vercel to include your contact email.

## 9. CORS Configuration
Ensure Render's `CORS_ORIGINS` variable matches the Vercel domains exactly (e.g., `["https://blr.life"]`).

## 10. GitHub Backup Secret
To enable the zero-cost GitHub Actions backup workflow:
1. Go to GitHub Repository Settings -> Secrets and Variables -> Actions.
2. Add a new secret `DATABASE_URL` containing the standard (non-asyncpg) PostgreSQL connection string.

## 11. Custom Domains
- Map `blr.life` to Vercel (via A/CNAME records provided by Vercel).
- Map `api.blr.life` to Render (via CNAME record to the `.onrender.com` address).

## 12. DNS
Manage DNS via your domain registrar (e.g., Cloudflare, Namecheap). Point the records to the respective platform endpoints.

## 13. TLS
- Vercel automatically issues and renews Let's Encrypt certificates for `blr.life`.
- Render automatically issues and renews certificates for `api.blr.life`.

## 14. Health Checks
The backend provides two endpoints:
- `/api/v1/health` (Liveness)
- `/api/v1/ready` (Readiness / DB check)
Render uses these to determine if the container booted successfully.

## 15. Cold-Start Expectations
Because this is a zero-cost architecture:
- **Backend (Render):** Sleeps after 15 mins. Takes ~45s to wake.
- **Database (Neon):** Scales to zero after 5 mins. Takes ~500ms to wake.
The frontend displays a "Starting the recommendation service..." message during these cold starts to improve UX.

## 16. Rollback
If a deployment fails:
- **Frontend:** Use Vercel's one-click "Instant Rollback".
- **Backend:** Select a previous successful build in Render and click "Deploy".
- **Database:** Neon free tier includes 6 hours of point-in-time recovery (PITR).

## 17. Production Smoke Test
After deployment, visit `https://blr.life`.
1. Type a location (e.g., "Indiranagar"). Wait for geocoding.
2. Select it. Wait for recommendations (this tests the Render to Neon connection).
3. If successful, V1 is operational.
