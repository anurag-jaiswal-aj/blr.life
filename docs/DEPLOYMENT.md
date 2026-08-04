# Production Deployment Guide

This document outlines the procedure for deploying `blr.life` to a Virtual Private Server (VPS) for the first time, as well as routine deployment, backup, and restore operations.

## Architecture

The V1 production architecture uses a Single-VPS Docker Compose topology:
- **Caddy**: Reverse proxy handling automatic TLS and routing.
- **Frontend (Web)**: Next.js standalone container.
- **Backend (API)**: FastAPI container.
- **Database (DB)**: PostgreSQL 16 + PostGIS 3.4.

**Security Boundaries:**
- Only Caddy exposes public ports (80/443).
- The internal Docker network (`blrlife_prod`) uses the `172.28.0.0/16` subnet.
- Uvicorn trusts `172.28.0.0/16` for `X-Forwarded-For` rate limiting.
- The database is completely inaccessible from the outside internet.

---

## 1. Prerequisites

### 1.1 VPS Requirements
- **OS**: Ubuntu 24.04 LTS (recommended).
- **RAM**: Minimum 2GB (4GB recommended). Node.js and Python builds require significant memory.
- **Storage**: At least 20GB SSD.
- **Swap**: Ensure at least 2GB of swap is enabled to prevent OOM kills during builds.

### 1.2 DNS Requirements
Before deploying, you must configure your domain's DNS records:
- `A` record for `blr.life` pointing to the VPS IP.
- `A` record for `api.blr.life` pointing to the VPS IP.

---

## 2. Server Preparation

1. **SSH into your VPS:**
   ```bash
   ssh root@your_vps_ip
   ```

2. **Configure Firewall (UFW):**
   ```bash
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```

3. **Install Docker:**
   Follow the [official Docker Engine installation guide for Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

---

## 3. First-Time Deployment

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/yourusername/blr.life.git
   cd blr.life
   ```

2. **Configure Environment Variables:**
   ```bash
   cp .env.production.example .env.production
   nano .env.production
   ```
   > [!IMPORTANT]
   > You **MUST** change `POSTGRES_PASSWORD` and update `DATABASE_URL` to match. Ensure `FRONTEND_HOST` and `API_HOST` match your actual DNS names.

3. **Secure the Environment File:**
   ```bash
   chmod 600 .env.production
   ```

4. **Build and Start Containers:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

5. **Run Database Migrations:**
   > [!NOTE]
   > We use `run --rm` for the initial migration to ensure it executes in an isolated container safely before relying on the long-running API process.
   ```bash
   docker compose -f docker-compose.prod.yml run --rm api alembic upgrade head
   ```

6. **Run Canonical Data Bootstrap:**
   > [!WARNING]
   > Do not interrupt these commands. They are required to populate the core Bengaluru datasets.
   ```bash
   docker compose -f docker-compose.prod.yml run --rm api python -m app.ingestion.cli ingest --file data/curated/bengaluru_localities_v1.json
   docker compose -f docker-compose.prod.yml run --rm api python -m app.ingestion.cli ingest-metro-data --file data/curated/bengaluru_metro_stations_v1.json
   docker compose -f docker-compose.prod.yml run --rm api python -m app.ingestion.cli calculate-metro-metrics
   docker compose -f docker-compose.prod.yml run --rm api python -m app.ingestion.cli ingest-amenity-data --file data/curated/bengaluru_amenities_v1.json
   docker compose -f docker-compose.prod.yml run --rm api python -m app.ingestion.cli calculate-amenity-metrics
   docker compose -f docker-compose.prod.yml run --rm api python -m app.ingestion.cli ingest-rent --file data/curated/bengaluru_rent_v1.json
   ```

7. **Verify Health:**
   Check Caddy logs to ensure TLS certificates were acquired successfully:
   ```bash
   docker compose -f docker-compose.prod.yml logs caddy
   ```
   Visit `https://blr.life` in your browser.

---

## 4. Routine Redeployment

When you push new code to `main`, run the following on the VPS to update:

```bash
cd blr.life
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

If the update includes database changes:
```bash
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```
*(We use `exec` here because the API container is already running and we want minimal downtime).*

---

## 5. Rollback

If a deployment introduces a critical regression, you can pin the code to a previous commit:

```bash
git checkout <previous_stable_commit_hash>
docker compose -f docker-compose.prod.yml up -d --build
```
> [!CAUTION]
> If a database migration was applied, rolling back the application code *will not* roll back the database schema. You must manually execute `docker compose exec api alembic downgrade <target_revision>` before rolling back the application code.

---

## 6. Backup & Restore

### 6.1 Creating a Backup
We use `pg_dump` to create a custom-format compressed backup of the `blrlife_prod` database.
```bash
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U blrlife_prod -F c blrlife_prod > backup_$(date +%Y%m%d).dump
```

> [!TIP]
> Use `scp` or `rsync` to download this `.dump` file to your local machine or a cloud storage provider. Do not leave backups accumulating on the VPS indefinitely.

### 6.2 Restoring a Backup
To restore a backup into a fresh database container:

1. Drop and recreate the database (Requires connecting as postgres superuser, or entirely destroying the docker volume):
   ```bash
   docker compose -f docker-compose.prod.yml down -v
   docker compose -f docker-compose.prod.yml up -d db
   ```
2. Wait 10 seconds for the database to initialize.
3. Restore the data:
   ```bash
   cat backup_YYYYMMDD.dump | docker compose -f docker-compose.prod.yml exec -T db pg_restore -U blrlife_prod -d blrlife_prod -1
   ```
4. Restart all services:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

---

## 7. Troubleshooting

- **Check all container logs:**
  ```bash
  docker compose -f docker-compose.prod.yml logs -f
  ```
- **Check specific container logs (e.g., API):**
  ```bash
  docker compose -f docker-compose.prod.yml logs -f api
  ```
- **Check disk space (Docker can consume a lot of space over time):**
  ```bash
  df -h
  docker system df
  # To clean up unused images/builders:
  docker system prune -a
  ```
