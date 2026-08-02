# Security Strategy

## Threat Model (V1)
V1 is a consumer-facing application with minimal sensitive data. The primary threats are:
- API abuse/scraping (costing us bandwidth or stealing our curated data).
- Denial of Service via expensive geospatial queries.
- Injection attacks.

## Authentication & Authorization
- **V1 Users**: Anonymous sessions. No PII stored other than location coordinates.
- **Admin**: Basic Auth or fixed JWT for internal scripts that update the database.

## Data Collection Minimization & Privacy
- **Precise Location**: When a user inputs their workplace, we do not store the exact latitude/longitude permanently linked to a user profile. If saving a recommendation, the coordinates are obfuscated or snapped to a grid (e.g., H3 hex bin) to prevent exact tracking of individuals.

## Validation & Injection
- All API inputs are validated using **Pydantic** in FastAPI.
- All database queries are parameterized using **SQLAlchemy** (preventing SQL Injection).
- Next.js handles output encoding to prevent **XSS**.

## Rate Limiting
- Implement IP-based rate limiting on the `/recommend` endpoint to prevent scraping and expensive DB DDOS.
- Use simple in-memory or Postgres-backed rate limiting for V1 (no Redis required yet).

## CORS & CSRF
- **CORS**: Strictly limited to the production frontend domain (e.g., `https://blr.life`).
- **CSRF**: As V1 relies on stateless, anonymous POST requests without session cookies, CSRF is largely mitigated. If sessions are added, standard CSRF tokens will be implemented.

## Secrets Management
- All secrets (DB passwords, internal API keys) are passed via environment variables.
- `.env` files are strictly added to `.gitignore`.

## Production Configuration
- Run FastAPI via Uvicorn with multiple workers behind a reverse proxy (e.g., Nginx or Traefik) handling HTTPS/TLS termination.
- Ensure the database port (5432) is NOT exposed to the public internet, only to the internal Docker network.
