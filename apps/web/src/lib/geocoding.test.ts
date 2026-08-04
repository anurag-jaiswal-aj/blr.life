import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchPlaces } from './geocoding';

describe('Geocoding Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array for queries shorter than 2 characters', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const results = await searchPlaces('a');
    
    expect(results).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls the internal proxy route and parses results correctly', async () => {
    const mockResults = [
      { place_id: 1, lat: 12.9716, lng: 77.5946, display_name: 'Bangalore', name: 'Bangalore' }
    ];
    
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults })
    } as Response);

    const results = await searchPlaces('bangalore');
    
    expect(fetchSpy).toHaveBeenCalledWith('/api/geocode?q=bangalore', { method: 'GET' });
    expect(results).toEqual(mockResults);
  });

  it('filters out invalid results from the proxy', async () => {
    const mockResults = [
      { place_id: 1, lat: 12.9716, lng: 77.5946, display_name: 'Bangalore', name: 'Bangalore' }, // Valid
      { place_id: 2, lat: 999, lng: 77.5946, display_name: 'Invalid Lat', name: 'Invalid' }, // Invalid lat
      { place_id: 'string_id', lat: 12.9, lng: 77.5, display_name: 'Invalid ID', name: 'Invalid' } // Invalid ID type
    ];
    
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResults })
    } as Response);

    const results = await searchPlaces('bangalore');
    
    expect(results).toHaveLength(1);
    expect(results[0].place_id).toBe(1);
  });

  it('throws an error on non-ok HTTP response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 502
    } as Response);

    await expect(searchPlaces('bangalore')).rejects.toThrow('Geocoding failed (HTTP 502)');
  });
});
