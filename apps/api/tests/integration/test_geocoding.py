import asyncio
import json
import urllib.error
from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.geocoding import GeocodingResponse
from app.services import geocoding


class MockResponse:
    def __init__(self, data: bytes, status: int = 200):
        self.data = data
        self.status = status

    def read(self) -> bytes:
        return self.data

    def __enter__(self) -> "MockResponse":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        pass


@pytest.fixture
def mock_urlopen(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    mock = MagicMock()
    # Default to empty results
    mock.return_value = MockResponse(b"[]", status=200)
    monkeypatch.setattr("app.services.geocoding.urllib.request.urlopen", mock)
    return mock


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture(autouse=True)
def reset_cache_and_pacing() -> None:
    # Reset singleton state before each test
    geocoding._cache.cache.clear()
    geocoding._last_upstream_fetch_time = 0.0
    geocoding._pacing_lock = asyncio.Lock()


async def test_short_query(async_client: AsyncClient, mock_urlopen: MagicMock) -> None:
    response = await async_client.get("/api/v1/geocode?q=a")
    assert response.status_code == 200
    data = response.json()
    assert data["results"] == []
    mock_urlopen.assert_not_called()


async def test_successful_upstream_response(
    async_client: AsyncClient, mock_urlopen: MagicMock
) -> None:
    mock_data = [
        {
            "place_id": 123,
            "lat": "12.9",
            "lon": "77.5",
            "display_name": "Bangalore",
            "name": "BLR",
        }
    ]
    mock_urlopen.return_value = MockResponse(json.dumps(mock_data).encode("utf-8"))

    response = await async_client.get("/api/v1/geocode?q=bangalore")
    assert response.status_code == 200
    data = GeocodingResponse.model_validate(response.json())
    assert len(data.results) == 1
    assert data.results[0].place_id == 123
    assert data.results[0].lat == 12.9
    assert data.results[0].lng == 77.5
    assert data.results[0].display_name == "Bangalore"
    assert data.results[0].name == "BLR"

    # Verify query params
    req = mock_urlopen.call_args[0][0]
    url = req.full_url
    assert "format=json" in url
    assert "countrycodes=in" in url
    assert "limit=5" in url
    assert "accept-language=en" in url
    assert "bounded=0" in url
    assert "viewbox=77.3%2C12.7%2C77.9%2C13.2" in url


async def test_malformed_upstream_result(
    async_client: AsyncClient, mock_urlopen: MagicMock
) -> None:
    mock_data = [
        {
            "place_id": 123,
            "lat": "12.9",
            "lon": "77.5",
            "display_name": "Bangalore",
            "name": "BLR",
        },
        {"place_id": "bad"},  # Missing fields
    ]
    mock_urlopen.return_value = MockResponse(json.dumps(mock_data).encode("utf-8"))

    response = await async_client.get("/api/v1/geocode?q=bangalore")
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 1  # Malformed item skipped


async def test_upstream_http_failure(async_client: AsyncClient, mock_urlopen: MagicMock) -> None:
    mock_urlopen.return_value = MockResponse(b"Error", status=500)
    response = await async_client.get("/api/v1/geocode?q=bangalore")
    assert response.status_code == 502
    data = response.json()
    assert data["results"] == []
    assert data["error"] == "Upstream geocoding service failed"


async def test_upstream_timeout(async_client: AsyncClient, mock_urlopen: MagicMock) -> None:
    mock_urlopen.side_effect = urllib.error.URLError("timeout")
    response = await async_client.get("/api/v1/geocode?q=bangalore")
    assert response.status_code == 502
    data = response.json()
    assert data["results"] == []
    assert data["error"] == "Upstream geocoding service failed"


async def test_malformed_json(async_client: AsyncClient, mock_urlopen: MagicMock) -> None:
    mock_urlopen.return_value = MockResponse(b"{bad json", status=200)
    response = await async_client.get("/api/v1/geocode?q=bangalore")
    assert response.status_code == 502


async def test_user_agent_and_referer_propagation(
    async_client: AsyncClient, mock_urlopen: MagicMock
) -> None:
    mock_urlopen.return_value = MockResponse(b"[]", status=200)
    await async_client.get("/api/v1/geocode?q=bangalore")
    req = mock_urlopen.call_args[0][0]
    assert "blr.life/1.0-dev" in req.headers["User-agent"]
    assert req.headers["Referer"] == "http://localhost:3000"


async def test_cache_copy_mutation_safety(
    async_client: AsyncClient, mock_urlopen: MagicMock
) -> None:
    mock_data = [
        {
            "place_id": 123,
            "lat": "12.9",
            "lon": "77.5",
            "display_name": "Bangalore",
            "name": "BLR",
        }
    ]
    mock_urlopen.return_value = MockResponse(json.dumps(mock_data).encode("utf-8"))

    # Initial request sets the cache
    await async_client.get("/api/v1/geocode?q=bangalore")

    # Get the cached result and mutate the list
    cached_result = geocoding._cache.get("bangalore")
    assert cached_result is not None
    cached_result.pop()

    # The next request should still return the full list because we popped from a copy
    response = await async_client.get("/api/v1/geocode?q=bangalore")
    data = response.json()
    assert len(data["results"]) == 1


async def test_cache_hit_and_expiry(
    async_client: AsyncClient, mock_urlopen: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    mock_urlopen.return_value = MockResponse(b"[]", status=200)

    # First call - cache miss
    await async_client.get("/api/v1/geocode?q=cache")
    assert mock_urlopen.call_count == 1

    # Second call - cache hit
    await async_client.get("/api/v1/geocode?q=cache")
    assert mock_urlopen.call_count == 1  # Still 1

    # Fast-forward time to expire cache
    import time
    future_time = time.monotonic() + 1000.0
    monkeypatch.setattr("app.services.geocoding.time.monotonic", lambda: future_time)

    # Third call - cache miss (expired)
    await async_client.get("/api/v1/geocode?q=cache")
    assert mock_urlopen.call_count == 2


async def test_cache_boundedness(async_client: AsyncClient, mock_urlopen: MagicMock) -> None:
    # Lower maxsize for test
    geocoding._cache.maxsize = 2

    mock_urlopen.return_value = MockResponse(b"[]", status=200)
    await async_client.get("/api/v1/geocode?q=a1")
    await async_client.get("/api/v1/geocode?q=a2")
    await async_client.get("/api/v1/geocode?q=a3")

    assert len(geocoding._cache.cache) == 2
    assert "a1" not in geocoding._cache.cache
    assert "a3" in geocoding._cache.cache


async def test_concurrent_pacing(
    async_client: AsyncClient, mock_urlopen: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    # We will mock asyncio.sleep to record sleep times instead of actually waiting
    sleep_calls = []

    async def mock_sleep(delay: float) -> None:
        sleep_calls.append(delay)
        # We also need to advance monotonic time so the next caller sees it
        geocoding._last_upstream_fetch_time -= delay  # Trick the time difference

    monkeypatch.setattr("app.services.geocoding.asyncio.sleep", mock_sleep)

    # Launch 3 requests concurrently for different queries (to avoid cache hits)
    await asyncio.gather(
        async_client.get("/api/v1/geocode?q=pace1"),
        async_client.get("/api/v1/geocode?q=pace2"),
        async_client.get("/api/v1/geocode?q=pace3"),
    )

    assert mock_urlopen.call_count == 3
    # Second and third requests will trigger sleep because
    # time.monotonic() hasn't naturally advanced 1.0s
    assert len(sleep_calls) == 2


async def test_cancellation_error_safety(
    async_client: AsyncClient, mock_urlopen: MagicMock
) -> None:
    # Force an error
    mock_urlopen.side_effect = urllib.error.URLError("fail")

    response = await async_client.get("/api/v1/geocode?q=error")
    assert response.status_code == 502

    # Ensure lock is released (we can acquire it immediately)
    assert not geocoding._pacing_lock.locked()


async def test_queue_exhaustion_timeout(
    async_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import time

    def slow_fetch_sync(*args, **kwargs):
        time.sleep(2.5)  # Longer than the 2.0s lock acquisition timeout
        return []

    monkeypatch.setattr("app.services.geocoding._fetch_nominatim_sync", slow_fetch_sync)

    # Launch two concurrent requests for different queries
    # The first acquires the lock and blocks in the thread for 2.5s.
    # The second attempts to acquire the lock, times out after 2.0s, and fails safely.
    results = await asyncio.gather(
        async_client.get("/api/v1/geocode?q=slow1"),
        async_client.get("/api/v1/geocode?q=slow2"),
    )

    statuses = [r.status_code for r in results]
    assert sorted(statuses) == [200, 502]

    # Verify the failed response preserves the safe public API contract
    failed_response = next(r for r in results if r.status_code == 502)
    data = failed_response.json()
    assert data["results"] == []
    assert data["error"] == "Upstream geocoding service failed"

    # Verify that the shared pacing lock was NOT left permanently locked
    # due to an asyncio.TimeoutError cancellation race condition.
    assert not geocoding._pacing_lock.locked()

    # Perform a subsequent request to prove actual recovery and that
    # the endpoint can successfully serve traffic again.
    # We must first remove the slow_fetch_sync mock so the request succeeds.
    monkeypatch.undo()

    # We need to re-mock urlopen so the test remains deterministic and doesn't hit real Nominatim
    mock_urlopen = MagicMock()
    mock_data = [
        {"place_id": 123, "lat": "12.9", "lon": "77.5", "display_name": "Bangalore", "name": "BLR"}
    ]
    mock_urlopen.return_value = MockResponse(json.dumps(mock_data).encode("utf-8"))
    monkeypatch.setattr("app.services.geocoding.urllib.request.urlopen", mock_urlopen)

    recovery_response = await async_client.get("/api/v1/geocode?q=recovery")
    assert recovery_response.status_code == 200
    assert len(recovery_response.json()["results"]) == 1
