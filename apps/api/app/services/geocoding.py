import asyncio
import json
import time
import urllib.parse
import urllib.request
from collections import OrderedDict
from typing import Any
from urllib.error import URLError

from app.core.config import settings
from app.core.logging import logger
from app.schemas.geocoding import GeocodingResult


class GeocodingException(Exception):
    """Exception raised when upstream geocoding fails."""


class SimpleTTLCache:
    def __init__(self, maxsize: int = 1000, ttl_seconds: float = 300.0) -> None:
        self.cache: OrderedDict[str, tuple[list[GeocodingResult], float]] = OrderedDict()
        self.maxsize = maxsize
        self.ttl = ttl_seconds

    def get(self, key: str) -> list[GeocodingResult] | None:
        if key in self.cache:
            value, expires = self.cache[key]
            if time.monotonic() < expires:
                self.cache.move_to_end(key)
                return list(value)
            else:
                del self.cache[key]
        return None

    def set(self, key: str, value: list[GeocodingResult]) -> None:
        if key in self.cache:
            del self.cache[key]
        elif len(self.cache) >= self.maxsize:
            # Remove the oldest item (FIFO/LRU depending on get() moving to end)
            self.cache.popitem(last=False)
        self.cache[key] = (value, time.monotonic() + self.ttl)


# Process-local state for rate limiting and caching.
# Note: This assumes a single worker process per Render container.
# If scaled to multiple workers without an external queue, pacing will be bypassed.
_cache = SimpleTTLCache()
_pacing_lock = asyncio.Lock()
_last_upstream_fetch_time: float = 0.0


def _fetch_nominatim_sync(
    url: str, user_agent: str, referer: str | None, timeout: float
) -> list[dict[str, Any]]:
    headers = {"User-Agent": user_agent}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(
        url,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status != 200:
                raise GeocodingException(f"Upstream returned HTTP {response.status}")
            body = response.read()
            data = json.loads(body)
            if not isinstance(data, list):
                raise GeocodingException("Upstream did not return a JSON array")
            return data
    except URLError as e:
        raise GeocodingException(f"Network error: {str(e)}") from e
    except json.JSONDecodeError as e:
        raise GeocodingException("Failed to decode JSON from upstream") from e
    except Exception as e:
        raise GeocodingException(f"Unexpected error: {str(e)}") from e


async def geocode_query(q: str) -> list[GeocodingResult]:
    """
    Geocode a query string using Nominatim, with process-local pacing and caching.
    """
    q_clean = q.strip().lower()
    if len(q_clean) < 2:
        return []

    # Check cache first
    cached = _cache.get(q_clean)
    if cached is not None:
        return cached

    # Prepare URL
    params = {
        "q": q_clean,
        "format": "json",
        "countrycodes": "in",
        "limit": "5",
        "accept-language": "en",
        "bounded": "0",
        "viewbox": "77.3,12.7,77.9,13.2",
    }
    qs = urllib.parse.urlencode(params)
    url = f"{settings.NOMINATIM_URL}?{qs}"

    global _last_upstream_fetch_time

    # Acquire lock to pace requests
    async with _pacing_lock:
        now = time.monotonic()
        time_since_last = now - _last_upstream_fetch_time
        if time_since_last < 1.0:
            await asyncio.sleep(1.0 - time_since_last)
        
        # Update timestamp immediately before upstream fetch
        _last_upstream_fetch_time = time.monotonic()

        referer = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else None
        logger.info(f"Geocoding upstream fetch for: {q_clean}")
        raw_results = await asyncio.to_thread(
            _fetch_nominatim_sync,
            url,
            settings.NOMINATIM_USER_AGENT,
            referer,
            settings.NOMINATIM_TIMEOUT_SECONDS,
        )

    # Process and validate results safely outside the lock
    results: list[GeocodingResult] = []
    for item in raw_results:
        try:
            place_id = int(item["place_id"])
            lat = float(item["lat"])
            lng = float(item["lon"])  # Note: Nominatim uses 'lon', our schema uses 'lng'
            display_name = str(item["display_name"])
            name = str(item["name"])
            
            results.append(
                GeocodingResult(
                    place_id=place_id,
                    lat=lat,
                    lng=lng,
                    display_name=display_name,
                    name=name,
                )
            )
        except (KeyError, ValueError, TypeError) as e:
            logger.warning(f"Skipping malformed Nominatim result: {e}")
            continue

    # Cache successful results
    _cache.set(q_clean, results)
    return results
