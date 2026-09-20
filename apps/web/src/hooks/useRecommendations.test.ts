/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, waitFor, act } from '@testing-library/react';
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
      work_location: { lat: 12.1, lng: 77.0 },
      constraints: {},
      preferences: { metro_access_weight: 1.0, short_commute_weight: 1.0, cafe_weight: 0, restaurant_weight: 0, park_weight: 0, healthcare_weight: 0, nightlife_weight: 0 },
    };

    const { result } = renderHook(() => useRecommendations(req as any));

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(api.fetchRecommendations).toHaveBeenCalledWith(req, expect.any(AbortSignal));
    expect(result.current.data).toEqual(mockRes);
    expect(result.current.error).toBeNull();
  });

  it('sets error when fetchRecommendations fails', async () => {
    vi.mocked(api.fetchRecommendations).mockRejectedValueOnce(new Error('API failure'));

    const req = {
      work_location: { lat: 12.2, lng: 77.0 },
      constraints: {},
      preferences: { metro_access_weight: 1.0, short_commute_weight: 1.0, cafe_weight: 0, restaurant_weight: 0, park_weight: 0, healthcare_weight: 0, nightlife_weight: 0 },
    };

    const { result } = renderHook(() => useRecommendations(req));

    await waitFor(() => {
      expect(result.current.error).toBe('API failure');
    });

    expect(api.fetchRecommendations).toHaveBeenCalledWith(req, expect.any(AbortSignal));
    expect(result.current.data).toBeNull();
  });

  it('sets isColdStarting to true if request takes longer than 5 seconds', async () => {
    vi.useFakeTimers();
    let resolveApi: (val: any) => void;
    const promise = new Promise((resolve) => {
      resolveApi = resolve;
    });
    vi.mocked(api.fetchRecommendations).mockReturnValueOnce(promise as any);

    const req = {
      work_location: { lat: 12.3, lng: 77.0 },
      constraints: {},
      preferences: { metro_access_weight: 1.0, short_commute_weight: 1.0, cafe_weight: 0, restaurant_weight: 0, park_weight: 0, healthcare_weight: 0, nightlife_weight: 0 },
    };

    const { result } = renderHook(() => useRecommendations(req));

    expect(result.current.loading).toBe(true);
    expect(result.current.isColdStarting).toBe(false);

    // Fast-forward 4.9 seconds (should not be cold starting yet)
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    expect(result.current.isColdStarting).toBe(false);

    // Fast-forward past 5 seconds
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.isColdStarting).toBe(true);

    // Resolve the API call
    act(() => {
      resolveApi!({ recommendations: [], provenance: { calc_versions_used: [] } });
    });

    // Flush microtasks
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.isColdStarting).toBe(false);

    vi.useRealTimers();
  });

  it('debounces rapid request changes within 300ms', () => {
    vi.useFakeTimers();
    const mockRes = { recommendations: [], provenance: { calc_versions_used: [] } };
    vi.mocked(api.fetchRecommendations).mockResolvedValue(mockRes as any);

    const reqA = { work_location: { lat: 1, lng: 1 }, constraints: {}, preferences: {} as any };
    const reqB = { work_location: { lat: 2, lng: 2 }, constraints: {}, preferences: {} as any };
    const reqC = { work_location: { lat: 3, lng: 3 }, constraints: {}, preferences: {} as any };

    const { rerender } = renderHook((req) => useRecommendations(req), { initialProps: reqA });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(reqB);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(reqC);

    // At this point, 200ms total passed since first request. None should have fired.
    expect(api.fetchRecommendations).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(350); // Pass the 300ms threshold for reqC
    });

    expect(api.fetchRecommendations).toHaveBeenCalledTimes(1);
    expect(api.fetchRecommendations).toHaveBeenCalledWith(reqC, expect.any(AbortSignal));

    vi.useRealTimers();
  });

  it('cancels pending fetch on unmount', () => {
    vi.useFakeTimers();
    const req = { work_location: { lat: 1, lng: 1 }, constraints: {}, preferences: {} as any };

    const { unmount } = renderHook(() => useRecommendations(req));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // The fetch should have been cleared on unmount.
    expect(api.fetchRecommendations).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('A -> B -> A uses cached A without calling API again', async () => {
    vi.useFakeTimers();
    const reqA = { work_location: { lat: 991, lng: 991 }, constraints: {}, preferences: {} as any };
    const reqB = { work_location: { lat: 992, lng: 992 }, constraints: {}, preferences: {} as any };

    const mockResA = { recommendations: [{ name: 'A' }], provenance: { calc_versions_used: [] } };
    const mockResB = { recommendations: [{ name: 'B' }], provenance: { calc_versions_used: [] } };

    vi.mocked(api.fetchRecommendations)
      .mockResolvedValueOnce(mockResA as any)
      .mockResolvedValueOnce(mockResB as any);

    const { result, rerender } = renderHook((req) => useRecommendations(req), { initialProps: reqA });

    // A fetches
    act(() => { vi.advanceTimersByTime(350); });
    await act(async () => { await Promise.resolve(); });
    expect(api.fetchRecommendations).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockResA);

    // Switch to B
    rerender(reqB);
    act(() => { vi.advanceTimersByTime(350); });
    await act(async () => { await Promise.resolve(); });
    expect(api.fetchRecommendations).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(mockResB);

    // Switch back to A
    rerender(reqA);
    // Should be instant, no debounce wait
    expect(result.current.data).toEqual(mockResA);
    expect(result.current.loading).toBe(false);
    expect(result.current.isColdStarting).toBe(false);

    // Fast-forward to prove no extra API call was scheduled
    act(() => { vi.advanceTimersByTime(350); });
    expect(api.fetchRecommendations).toHaveBeenCalledTimes(2); // Still 2

    vi.useRealTimers();
  });

  it('failed requests are not cached', async () => {
    vi.useFakeTimers();
    const req = { work_location: { lat: 993, lng: 993 }, constraints: {}, preferences: {} as any };

    vi.mocked(api.fetchRecommendations)
      .mockRejectedValueOnce(new Error('API failure'))
      .mockResolvedValueOnce({ recommendations: [], provenance: { calc_versions_used: [] } } as any);

    const { result, rerender } = renderHook((r) => useRecommendations(r), { initialProps: req });

    act(() => { vi.advanceTimersByTime(350); });
    await act(async () => { await Promise.resolve(); });
    expect(api.fetchRecommendations).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe('API failure');

    act(() => { result.current.retry(); });
    act(() => { vi.advanceTimersByTime(350); });
    await act(async () => { await Promise.resolve(); });

    expect(api.fetchRecommendations).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();

    vi.useRealTimers();
  });

  it('empty successful response is cached normally', async () => {
    vi.useFakeTimers();
    const req = { work_location: { lat: 994, lng: 994 }, constraints: {}, preferences: {} as any };
    const mockRes = { recommendations: [], provenance: { calc_versions_used: [] } };

    vi.mocked(api.fetchRecommendations).mockResolvedValueOnce(mockRes as any);

    const { result, rerender } = renderHook((r) => useRecommendations(r), { initialProps: req });
    act(() => { vi.advanceTimersByTime(350); });
    await act(async () => { await Promise.resolve(); });
    expect(api.fetchRecommendations).toHaveBeenCalledTimes(1);

    rerender(null as any);
    rerender(req);

    expect(result.current.data).toEqual(mockRes);
    expect(api.fetchRecommendations).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('evicts oldest entries when exceeding FIFO limit', async () => {
    vi.useFakeTimers();
    const mockRes = { recommendations: [], provenance: { calc_versions_used: [] } };
    vi.mocked(api.fetchRecommendations).mockResolvedValue(mockRes as any);

    const { result, rerender } = renderHook((req) => useRecommendations(req), {
      initialProps: { work_location: { lat: 1000, lng: 1000 }, constraints: {}, preferences: {} as any }
    });

    for (let i = 1000; i <= 1050; i++) {
      rerender({ work_location: { lat: i, lng: i }, constraints: {}, preferences: {} as any });
      act(() => { vi.advanceTimersByTime(350); });
      await act(async () => { await Promise.resolve(); });
    }

    const initialCallCount = vi.mocked(api.fetchRecommendations).mock.calls.length;

    // Request 1000 should be evicted. Requesting it again should trigger an API call.
    rerender({ work_location: { lat: 1000, lng: 1000 }, constraints: {}, preferences: {} as any });
    act(() => { vi.advanceTimersByTime(350); });
    await act(async () => { await Promise.resolve(); });

    expect(api.fetchRecommendations).toHaveBeenCalledTimes(initialCallCount + 1);

    // Request 1050 should still be in cache
    rerender({ work_location: { lat: 1050, lng: 1050 }, constraints: {}, preferences: {} as any });
    expect(api.fetchRecommendations).toHaveBeenCalledTimes(initialCallCount + 1); // No new call

    vi.useRealTimers();
  });

  it('preserves stale-response protection (in-flight response does not populate cache incorrectly)', async () => {
    vi.useFakeTimers();
    let resolveA: (val: any) => void;
    let resolveB: (val: any) => void;

    vi.mocked(api.fetchRecommendations)
      .mockImplementationOnce(() => new Promise(r => { resolveA = r; }))
      .mockImplementationOnce(() => new Promise(r => { resolveB = r; }));

    const reqA = { work_location: { lat: 2000, lng: 2000 }, constraints: {}, preferences: {} as any };
    const reqB = { work_location: { lat: 2001, lng: 2001 }, constraints: {}, preferences: {} as any };

    const { result, rerender } = renderHook((req) => useRecommendations(req), { initialProps: reqA });

    act(() => { vi.advanceTimersByTime(350); });

    rerender(reqB);
    act(() => { vi.advanceTimersByTime(350); });

    const mockResA = { recommendations: [{ name: 'A' }], provenance: { calc_versions_used: [] } };
    await act(async () => {
      resolveA!(mockResA);
      await Promise.resolve();
    });

    const mockResB = { recommendations: [{ name: 'B' }], provenance: { calc_versions_used: [] } };
    await act(async () => {
      resolveB!(mockResB);
      await Promise.resolve();
    });

    expect(result.current.data).toEqual(mockResB);

    rerender(reqA);
    act(() => { vi.advanceTimersByTime(10); });

    // A should not be cached because active was false when it resolved
    const currentCalls = vi.mocked(api.fetchRecommendations).mock.calls.length;
    act(() => { vi.advanceTimersByTime(350); });
    expect(api.fetchRecommendations).toHaveBeenCalledTimes(currentCalls + 1);

    vi.useRealTimers();
  });

  it('passes an AbortSignal to fetchRecommendations', async () => {
    vi.useFakeTimers();
    const req = { work_location: { lat: 10, lng: 10 }, constraints: {}, preferences: {} as any };
    vi.mocked(api.fetchRecommendations).mockResolvedValueOnce({ recommendations: [], provenance: { calc_versions_used: [] } } as any);

    renderHook(() => useRecommendations(req));
    act(() => { vi.advanceTimersByTime(350); });
    await act(async () => { await Promise.resolve(); });

    expect(api.fetchRecommendations).toHaveBeenCalledWith(req, expect.any(AbortSignal));
    vi.useRealTimers();
  });

  it('aborts the in-flight request when dependencies change (A -> B)', async () => {
    vi.useFakeTimers();
    const reqA = { work_location: { lat: 200, lng: 200 }, constraints: {}, preferences: {} as any };
    const reqB = { work_location: { lat: 201, lng: 201 }, constraints: {}, preferences: {} as any };

    vi.mocked(api.fetchRecommendations).mockImplementation(() => {
      return new Promise(() => {}); // never resolves
    });

    const { rerender } = renderHook((req) => useRecommendations(req), { initialProps: reqA });

    // We must await after advancing timers to let the mock be called and promise created
    act(() => { vi.advanceTimersByTime(350); });
    await act(async () => { await Promise.resolve(); });

    const callA = vi.mocked(api.fetchRecommendations).mock.calls[0];
    const capturedSignalA = callA[1] as AbortSignal;
    expect(capturedSignalA).toBeDefined();
    expect(capturedSignalA.aborted).toBe(false);

    // Switch to B, should abort A's signal
    rerender(reqB);
    expect(capturedSignalA.aborted).toBe(true);

    vi.useRealTimers();
  });

  it('intentional AbortError does NOT set the user-facing error state and does NOT cache', async () => {
    vi.useFakeTimers();
    const req = { work_location: { lat: 12, lng: 12 }, constraints: {}, preferences: {} as any };

    vi.mocked(api.fetchRecommendations).mockImplementation((r, signal) => {
      return new Promise((resolve, reject) => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });

    const { result, rerender } = renderHook((req) => useRecommendations(req), { initialProps: req });
    act(() => { vi.advanceTimersByTime(350); });
    await act(async () => { await Promise.resolve(); });

    // Ensure error state is still null because it was an AbortError
    expect(result.current.error).toBeNull();

    // Ensure it was not cached. If we mock resolve next, it should call the API again.
    vi.mocked(api.fetchRecommendations).mockResolvedValueOnce({ recommendations: [], provenance: { calc_versions_used: [] } } as any);

    act(() => { result.current.retry(); });
    act(() => { vi.advanceTimersByTime(350); });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.data).toBeDefined();
    expect(result.current.error).toBeNull();

    vi.useRealTimers();
  });
});
