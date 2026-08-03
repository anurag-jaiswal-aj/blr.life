/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, waitFor } from '@testing-library/react';
import { useRecommendations } from './useRecommendations';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchRecommendations: vi.fn(),
}));

describe('useRecommendations (SUBMISSION)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call fetchRecommendations if request is null', () => {
    const { result } = renderHook(() => useRecommendations(null));
    expect(api.fetchRecommendations).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('calls fetchRecommendations and sets data on success', async () => {
    const mockRes = { recommendations: [], provenance: { calc_versions_used: [] } };
    vi.mocked(api.fetchRecommendations).mockResolvedValueOnce(mockRes as any);

    const req = {
      work_location: { lat: 12.0, lng: 77.0 },
      constraints: {},
      preferences: { metro_access_weight: 1.0, short_commute_weight: 1.0, cafe_weight: 0, restaurant_weight: 0, park_weight: 0, healthcare_weight: 0, nightlife_weight: 0 },
    };

    const { result } = renderHook(() => useRecommendations(req as any));
    
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(api.fetchRecommendations).toHaveBeenCalledWith(req);
    expect(result.current.data).toEqual(mockRes);
    expect(result.current.error).toBeNull();
  });

  it('sets error when fetchRecommendations fails', async () => {
    vi.mocked(api.fetchRecommendations).mockRejectedValueOnce(new Error('API failure'));

    const req = {
      work_location: { lat: 12.0, lng: 77.0 },
      constraints: {},
      preferences: { metro_access_weight: 1.0, short_commute_weight: 1.0, cafe_weight: 0, restaurant_weight: 0, park_weight: 0, healthcare_weight: 0, nightlife_weight: 0 },
    };

    const { result } = renderHook(() => useRecommendations(req));
    
    await waitFor(() => {
      expect(result.current.error).toBe('API failure');
    });

    expect(api.fetchRecommendations).toHaveBeenCalledWith(req);
    expect(result.current.data).toBeNull();
  });
});
