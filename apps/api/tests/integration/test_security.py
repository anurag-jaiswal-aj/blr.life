import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


async def test_security_headers(async_client: AsyncClient) -> None:
    response = await async_client.get("/health")
    assert response.status_code == 200
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


async def test_request_id_present(async_client: AsyncClient) -> None:
    response = await async_client.get("/health")
    assert response.status_code == 200
    assert "X-Request-ID" in response.headers
    assert len(response.headers["X-Request-ID"]) > 0


async def test_cors_methods(async_client: AsyncClient) -> None:
    # Pre-flight request for a disallowed method
    response = await async_client.options(
        "/api/v1/recommend",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "DELETE",
            "Access-Control-Request-Headers": "X-Requested-With",
        },
    )
    # Browsers interpret a missing Access-Control-Allow-Methods for DELETE as rejected
    # In Starlette CORSMiddleware, it might either omit the header or not list DELETE.
    allowed = response.headers.get("Access-Control-Allow-Methods", "")
    assert "DELETE" not in allowed
    assert "POST" in allowed or allowed == ""


async def test_rate_limiting(async_client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # Mock the DB and recommendation engine so we can get 200 OKs without hitting PostGIS
    async def mock_get_candidates(*args, **kwargs):
        return []

    def mock_rank(*args, **kwargs):
        return [], []

    monkeypatch.setattr(
        "app.api.v1.endpoints.recommend.get_candidate_localities", mock_get_candidates
    )
    monkeypatch.setattr("app.api.v1.endpoints.recommend.rank_candidates", mock_rank)

    from app.db.session import get_db

    app.dependency_overrides[get_db] = lambda: None

    payload = {
        "work_location": {"lat": 12.9716, "lng": 77.5946},
        "constraints": {"max_budget_inr": 30000, "bhk_type": "2bhk"},
        "limit": 1,
    }

    from httpx import ASGITransport

    transport = ASGITransport(app=app, client=("1.2.3.4", 12345))
    async with AsyncClient(transport=transport, base_url="http://test") as fresh_client:
        # Hit it 10 times (the default rate limit is 10/minute)
        for _ in range(10):
            response = await fresh_client.post("/api/v1/recommend", json=payload)
            assert response.status_code == 200

        # The 11th request should be rate limited
        response = await fresh_client.post("/api/v1/recommend", json=payload)
        assert response.status_code == 429
        assert response.json() == {"detail": "Too many requests. Please try again later."}
        assert "Retry-After" in response.headers

        # But health check should still work!
        health_res = await fresh_client.get("/health")
        assert health_res.status_code == 200

    app.dependency_overrides.clear()


async def test_generic_500_sanitization(
    async_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # We patch a function called INSIDE an existing route,
    # so the exception happens during request handling
    async def mock_db_check():
        raise ValueError("Simulated internal catastrophic failure")

    monkeypatch.setattr("app.main.check_database_connection", mock_db_check)

    # Use ASGITransport with raise_app_exceptions=False so the client doesn't throw the exception
    # and instead returns the 500 response.
    from httpx import ASGITransport

    from app.main import app

    transport = ASGITransport(app=app, raise_app_exceptions=False)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/ready")

        assert response.status_code == 500
        data = response.json()
        assert data == {"detail": "Internal server error"}
        assert "Simulated internal catastrophic failure" not in response.text


async def test_cors_allowed_origin(async_client: AsyncClient) -> None:
    response = await async_client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


async def test_cors_disallowed_origin(async_client: AsyncClient) -> None:
    response = await async_client.get("/health", headers={"Origin": "http://evil.com"})
    assert response.status_code == 200
    # Should not reflect the evil origin
    assert response.headers.get("access-control-allow-origin") != "http://evil.com"


async def test_cors_preflight(async_client: AsyncClient) -> None:
    response = await async_client.options(
        "/api/v1/recommend",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert "POST" in response.headers.get("access-control-allow-methods", "")


async def test_cors_on_500(monkeypatch: pytest.MonkeyPatch) -> None:
    async def mock_db_check():
        raise ValueError("Simulated catastrophic failure")

    monkeypatch.setattr("app.main.check_database_connection", mock_db_check)

    from httpx import ASGITransport

    from app.main import app

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/ready", headers={"Origin": "http://localhost:3000"})
        assert response.status_code == 500
        # Ensure CORS, RequestID and Security headers survive the 500
        # thanks to ExceptionCatcherMiddleware
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
        assert "X-Request-ID" in response.headers
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
