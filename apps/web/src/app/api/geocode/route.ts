import { NextRequest, NextResponse } from 'next/server';

// Bengaluru bounding box (viewbox for Nominatim bias)
const BENGALURU_VIEWBOX = '77.3,12.7,77.9,13.2';

// Simple in-memory cache to avoid sending repeated identical queries upstream.
// Per Nominatim policy: "Clients sending repeatedly the same query may be classified
// as faulty and blocked." Cache is keyed by normalised query string.
const cache = new Map<string, { data: NominatimResult[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Maximum results to return downstream
const RESULT_LIMIT = 5;

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name: string;
  type: string;
  importance: number;
}

export interface GeocodingResult {
  place_id: number;
  lat: number;
  lng: number;
  display_name: string;
  name: string;
}

function isValidNominatimResult(r: unknown): r is NominatimResult {
  if (!r || typeof r !== 'object') return false;
  const obj = r as Record<string, unknown>;
  return (
    typeof obj.place_id === 'number' &&
    typeof obj.lat === 'string' &&
    typeof obj.lon === 'string' &&
    typeof obj.display_name === 'string' &&
    typeof obj.name === 'string' &&
    !isNaN(parseFloat(obj.lat as string)) &&
    !isNaN(parseFloat(obj.lon as string))
  );
}

function toGeocodingResult(r: NominatimResult): GeocodingResult {
  return {
    place_id: r.place_id,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    display_name: r.display_name,
    name: r.name,
  };
}

let lastUpstreamFetchTime = 0;
let requestQueuePromise: Promise<void> = Promise.resolve();

async function pacedUpstreamFetch(url: string, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    requestQueuePromise = requestQueuePromise.then(async () => {
      const now = Date.now();
      const timeSinceLast = now - lastUpstreamFetchTime;
      // Enforce at least 1000ms between the start of upstream requests
      if (timeSinceLast < 1000) {
        await new Promise(r => setTimeout(r, 1000 - timeSinceLast));
      }
      
      try {
        lastUpstreamFetchTime = Date.now();
        const res = await fetch(url, init);
        resolve(res);
      } catch (err) {
        reject(err);
      }
    }).catch(reject);
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = (searchParams.get('q') ?? '').trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = q.toLowerCase();
  const now = Date.now();

  // Serve from cache if still valid
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ results: cached.data.map(toGeocodingResult) });
  }

  const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
  nominatimUrl.searchParams.set('q', q);
  nominatimUrl.searchParams.set('format', 'json');
  nominatimUrl.searchParams.set('countrycodes', 'in');
  nominatimUrl.searchParams.set('limit', String(RESULT_LIMIT));
  nominatimUrl.searchParams.set('accept-language', 'en');
  nominatimUrl.searchParams.set('viewbox', BENGALURU_VIEWBOX);
  // bounded=0 so we get global results if nothing in viewbox, but biased toward it
  nominatimUrl.searchParams.set('bounded', '0');

  try {
    const response = await pacedUpstreamFetch(nominatimUrl.toString(), {
      headers: {
        // Nominatim policy requires a valid identifying User-Agent.
        // This is set server-side (Next.js API route) where we can control it.
        'User-Agent': 'blr.life/1.0 (https://github.com/blr-life/blr.life)',
        // Referer is also accepted as an identifier per Nominatim policy.
        'Referer': 'https://blr.life',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Geocoding provider error', results: [] },
        { status: 502 }
      );
    }

    const raw: unknown = await response.json();

    if (!Array.isArray(raw)) {
      return NextResponse.json({ results: [] });
    }

    const valid = raw.filter(isValidNominatimResult);
    cache.set(cacheKey, { data: valid, expiresAt: Date.now() + CACHE_TTL_MS });

    return NextResponse.json({ results: valid.map(toGeocodingResult) });
  } catch {
    return NextResponse.json(
      { error: 'Network error contacting geocoding provider', results: [] },
      { status: 502 }
    );
  }
}
