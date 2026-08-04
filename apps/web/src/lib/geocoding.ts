export interface GeocodingResult {
  place_id: number;
  lat: number;
  lng: number;
  display_name: string;
  name: string;
}

interface GeocodingResponse {
  results: GeocodingResult[];
  error?: string;
}

function isGeocodingResult(r: unknown): r is GeocodingResult {
  if (!r || typeof r !== 'object') return false;
  const obj = r as Record<string, unknown>;
  return (
    typeof obj.place_id === 'number' &&
    typeof obj.lat === 'number' &&
    typeof obj.lng === 'number' &&
    typeof obj.display_name === 'string' &&
    typeof obj.name === 'string' &&
    obj.lat >= -90 &&
    obj.lat <= 90 &&
    obj.lng >= -180 &&
    obj.lng <= 180
  );
}

/**
 * Search for places by name using our server-side geocoding proxy.
 *
 * - Calls our own /api/geocode route (which proxies Nominatim server-side).
 * - Does NOT call Nominatim directly from the browser.
 * - Validates all returned coordinates before returning them.
 * - Throws on network errors so callers can display an appropriate error state.
 */
export async function searchPlaces(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const url = `/api/geocode?q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`Geocoding failed (HTTP ${response.status})`);
  }

  const body: unknown = await response.json();

  if (!body || typeof body !== 'object') {
    throw new Error('Unexpected geocoding response format');
  }

  const typedBody = body as GeocodingResponse;

  if (!Array.isArray(typedBody.results)) {
    return [];
  }

  // Validate every result — treat external API output as untrusted
  return typedBody.results.filter(isGeocodingResult);
}
