/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchRecommendations } from './api';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('api (API REQUEST SERIALIZATION)', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('serializes request correctly and handles success', async () => {
    const mockResponse = { recommendations: [], provenance: { calc_versions_used: [] } };
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    } as any);

    const req = {
      work_location: { lat: 12.0, lng: 77.0 },
      constraints: { max_work_distance_km: 15 },
      preferences: { metro_access_weight: 1.0, short_commute_weight: 1.0 },
    };

    const res = await fetchRecommendations(req);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/recommend'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      })
    );
    expect(res).toEqual(mockResponse);
  });

  it('throws error with message on failure', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Validation Error' })
    } as any);

    const req = {
      work_location: { lat: 12.0, lng: 77.0 },
      constraints: { max_work_distance_km: 15 },
      preferences: { metro_access_weight: 1.0, short_commute_weight: 1.0 },
    };

    await expect(fetchRecommendations(req)).rejects.toThrow('Validation Error');
  });
});
