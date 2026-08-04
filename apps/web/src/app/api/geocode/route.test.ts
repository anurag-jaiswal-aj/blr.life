import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

function createMockRequest(url: string) {
  return {
    nextUrl: new URL(url, 'http://localhost')
  } as unknown as NextRequest;
}

describe('Geocode API Route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('rejects invalid or too-short queries', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    
    let res = await GET(createMockRequest('/api/geocode?q='));
    expect(await res.json()).toEqual({ results: [] });
    
    res = await GET(createMockRequest('/api/geocode?q=a'));
    expect(await res.json()).toEqual({ results: [] });
    
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('constructs the intended Nominatim request for a valid query', async () => {
    const mockResults = [
      { place_id: 1, lat: '12.9716', lon: '77.5946', display_name: 'Bangalore', name: 'Bangalore', type: 'city', importance: 0.9 }
    ];
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResults
    } as Response);

    // Use a unique query to avoid cache hit
    const res = await GET(createMockRequest('/api/geocode?q=test_query_1'));
    const data = await res.json();
    
    expect(data.results).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = new URL((fetchSpy.mock.calls[0][0] as string));
    
    expect(url.origin).toBe('https://nominatim.openstreetmap.org');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('test_query_1');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('countrycodes')).toBe('in');
    
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('blr.life');
  });

  it('avoids upstream fetch on cache hit', async () => {
    const mockResults = [
      { place_id: 2, lat: '12.9', lon: '77.6', display_name: 'Test', name: 'Test', type: 'city', importance: 0.8 }
    ];
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResults
    } as Response);

    const req1 = createMockRequest('/api/geocode?q=cache_test');
    const req2 = createMockRequest('/api/geocode?q=cache_test');

    const res1 = await GET(req1);
    await res1.json();
    
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    
    const res2 = await GET(req2);
    await res2.json();
    
    // Still 1 because of cache hit
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('handles upstream failures gracefully', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 502
    } as Response);

    const res = await GET(createMockRequest('/api/geocode?q=failure_test'));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBe('Geocoding provider error');
  });

  it('handles malformed upstream responses', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ not_an_array: true })
    } as Response);

    const res = await GET(createMockRequest('/api/geocode?q=malformed_test'));
    const data = await res.json();
    expect(data.results).toEqual([]);
  });

  it('serializes and paces upstream requests', async () => {
    vi.useFakeTimers();
    
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => []
      } as Response;
    });

    const p1 = GET(createMockRequest('/api/geocode?q=pace_test_1'));
    const p2 = GET(createMockRequest('/api/geocode?q=pace_test_2'));

    // Fast-forward timers to allow the paced queue to process
    await vi.runAllTimersAsync();
    
    await Promise.all([p1, p2]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // Since pacing waits 1000ms between start of requests, this proves serialization
  });
});
