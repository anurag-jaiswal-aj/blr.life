# blr.life V1 Zero-Cost Deployment Guide

**NOTE:** This is a FUTURE deployment guide. The application is currently NOT deployed. Any domain values shown (like `<frontend-domain.example>`) are placeholders to be replaced when deployment is actually performed. `blr.life` refers exclusively to the product name, not a registered domain.

This guide documents the production deployment architecture for blr.life V1.
The infrastructure is designed to cost **₹0/month** by leveraging free tiers from Vercel, Render, and Neon.

## Architecture Overview

```text
      [ User Browser ]
             |
             |  (HTTPS / Vercel Edge)
             v
   [ Vercel Next.js ]
             |
             |  (HTTPS / <api-domain.example>)
             v
 [ Render FastAPI (Docker) ] ---> [ OSM Nominatim ]
             |
             |  (PostgreSQL TCP/IP)
             v
 [ Neon PostgreSQL + PostGIS ]
```
 22:
 23: ## 1. Neon Setup (Database)
 24: 1. Create a free account at [Neon.tech](https://neon.tech).
 25: 2. Create a new project (e.g., `blrlife-v1`).
 26: 3. Note the connection string (e.g., `postgres://[user]:[password]@[host]/[dbname]?sslmode=require`).
 27:
 28: ## 2. PostGIS Enablement & Verification
 29: Neon supports PostGIS. Before migrating:
 30: 1. Connect to the Neon database using a SQL client.
 31: 2. Run: `CREATE EXTENSION IF NOT EXISTS postgis;`
 32: 3. Verify: `SELECT PostGIS_Version();`
 33:
 34: ## 3. DATABASE_URL Configuration
 35: Construct the SQLAlchemy-compatible async URL:
 36: - Original: `postgres://...`
 37: - Required: `postgresql+asyncpg://[user]:[password]@[host]/[dbname]?sslmode=require`
 38:
 39: ## 4. Alembic Migration
 40: Migrations must be run manually or via CI against the Neon database.
 41: *Do not run migrations from a Vercel build step.*
 42: 1. Set `DATABASE_URL` in your local `.env`.
 43: 2. Run `make migrate` locally to upgrade the Neon database to head.
 44:
 45: ## 5. Production Bootstrap
 46: Bootstrap the V1 data into Neon:
 47: 1. Set `DATABASE_URL` in your local `.env`.
 48: 2. Run `make bootstrap` locally to ingest the curated JSON data into the production database.
 49:
 50: ## 6. Render Backend Configuration (API)
 51: 1. Create a **New Web Service** on [Render](https://render.com).
 52: 2. Connect the GitHub repository.
 53: 3. Select **Docker** as the environment.
 54: 4. Set the Dockerfile path to `apps/api/Dockerfile` (if necessary, override root directory to `apps/api`).
 55: 5. Set Exposed Port to `8000` (Render overrides PORT automatically, but ensure config matches).
 56: 6. Configure the Health Check path to `/health` (HTTP).
7. Add Environment Variables:
   - `ENVIRONMENT` = `production`
   - `DATABASE_URL` = (The async Neon URL)
   - `CORS_ORIGINS` = `["https://<frontend-domain.example>"]` (Example of the required frontend URL)
   - `TRUSTED_HOSTS` = `["<api-domain.example>", "*.onrender.com"]` (Example including Render's wildcard if appropriate)
   - `FORWARDED_ALLOW_IPS` = (Configure trusted proxy addresses appropriate to the hosting provider's topology. The application intentionally sanitizes `*` to `127.0.0.1` for security. Do NOT blindly trust arbitrary X-Forwarded-For values.)
   - `NOMINATIM_USER_AGENT` = `blr.life/1.0 (contact@your-email.com)` (Example requiring a real contact address)
8. Choose the **Free** instance type. Note: Render free instances sleep after 15 minutes of inactivity.
 64:
 65: ## 7. Vercel Frontend Configuration (Next.js)
 66: 1. Create a new Project on [Vercel](https://vercel.com).
 67: 2. Select **Next.js** framework.
 68: 3. Set the Root Directory to `apps/web`.
 69: 4. Add Environment Variables:
 70:    - `NEXT_PUBLIC_API_BASE_URL` = `https://<api-domain.example>` (Example future deployment value, or use Render's `.onrender.com` URL)
 72:
 73: ## 8. Nominatim Identification Configuration
 74: OpenStreetMap policy requires a valid `User-Agent`.
 75: Configure the `NOMINATIM_USER_AGENT` environment variable in the backend API (Render/FastAPI) to include your contact email.
 76:
 77: ## 9. CORS Configuration
 78: Ensure Render's `CORS_ORIGINS` variable matches the chosen frontend domains exactly (e.g., `["https://<frontend-domain.example>"]`).
 79:
 80: ## 10. GitHub Backup Secret
 81: To enable the zero-cost GitHub Actions backup workflow:
 82: 1. In the GitHub repository, go to **Settings > Secrets and variables > Actions**.
 83: 2. Add a new repository secret named `NEON_DATABASE_URL` with the standard (not asyncpg) Neon connection string.
 84:
 85: ## 11. Custom Domains
 86: - Configure the chosen frontend domain to point to the Vercel project (via A/CNAME records provided by Vercel).
 87: - Configure the chosen API domain to point to the Render service (via CNAME record to the `.onrender.com` address).
 88:
 89: ## 12. DNS
 90: Manage DNS via your domain registrar (e.g., Cloudflare, Namecheap). Point the records to the respective platform endpoints.
 91:
 92: ## 13. TLS
 93: - Vercel automatically issues and renews Let's Encrypt certificates for the chosen frontend domain.
 94: - Render automatically issues and renews certificates for the chosen API domain.
 95:
 96: ## 14. Health Checks
 97: The backend provides two endpoints:
 98: - `/health` (Liveness)
 99: - `/ready` (Readiness / DB check)
100: Render uses these to determine if the container booted successfully and is ready to receive traffic.
101:
102: ## 15. Cold-Start Expectations
103: Because this is a zero-cost architecture:
104: - **Backend (Render):** Render Free instances sleep after 15 mins. Cold start takes 30-60s.
105: - **Database (Neon):** Scales to zero after 5 mins. Takes ~500ms to wake.
106: The frontend will gracefully handle the Render cold start but the first search may take ~45s.
107:
108: ## 16. Rollback
109: If a deployment fails:
110: - **Frontend:** Use Vercel's one-click "Instant Rollback".
111: - **Backend:** Select a previous successful deployment in Render and click redeploy.
- **Database:** Neon free tier includes 6 hours of point-in-time recovery (PITR).

## 17. Production Smoke Test
After deployment, visit your chosen frontend URL (e.g., `https://<frontend-domain.example>`).
1. Type a location (e.g., "Indiranagar"). Wait for geocoding.
2. Select it. Wait for recommendations (this tests the Render to Neon connection).
3. If successful, V1 is operational.
