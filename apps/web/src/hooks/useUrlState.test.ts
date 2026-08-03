/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, act } from '@testing-library/react';
import { useUrlState } from './useUrlState';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as navigation from 'next/navigation';

describe('useUrlState', () => {
  beforeEach(() => {
    (navigation as any).__setSearchParams('');
    vi.clearAllMocks();
  });

  it('initializes with default state when URL is empty', () => {
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state).toEqual({ lat: null, lng: null, max_dist: 15.0, w_metro: 1.0, w_work: 1.0, w_cafe: 0.0, w_restaurant: 0.0, w_park: 0.0, w_healthcare: 0.0, w_nightlife: 0.0, max_budget_inr: null, bhk_type: null });
  });

  it('parses valid query parameters correctly (URL PARSING)', () => {
    (navigation as any).__setSearchParams('lat=12.9&lng=77.6&max_dist=10&w_metro=0.5&w_work=0.8&w_cafe=0.1&w_rest=0.2&w_park=0.3&w_health=0.4&w_night=0.5');
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state).toEqual({ lat: 12.9, lng: 77.6, max_dist: 10.0, w_metro: 0.5, w_work: 0.8, w_cafe: 0.1, w_restaurant: 0.2, w_park: 0.3, w_healthcare: 0.4, w_nightlife: 0.5, max_budget_inr: null, bhk_type: null });
  });

  it('handles malformed and invalid URLs safely (MALFORMED URL HANDLING)', () => {
    (navigation as any).__setSearchParams('lat=invalid&lng=NaN&max_dist=-5&w_metro=1.5&w_work=-0.1&w_cafe=-1&w_rest=5&w_park=invalid&w_health=NaN&w_night=2');
    const { result } = renderHook(() => useUrlState());
    expect(result.current.state).toEqual({ lat: null, lng: null, max_dist: 15.0, w_metro: 1.0, w_work: 1.0, w_cafe: 0.0, w_restaurant: 0.0, w_park: 0.0, w_healthcare: 0.0, w_nightlife: 0.0, max_budget_inr: null, bhk_type: null });
  });

  it('updates state and pushes to router (URL SERIALIZATION)', () => {
    const pushMock = (navigation as any).__getPushMock();
    const { result } = renderHook(() => useUrlState());
    
    act(() => {
      result.current.updateState({ lat: 13.0, lng: 77.5, max_dist: 5, w_metro: 0, w_work: 0, w_cafe: 1.0, w_restaurant: 1.0, w_park: 1.0, w_healthcare: 1.0, w_nightlife: 1.0 });
    });

    expect(pushMock).toHaveBeenCalled();
    const pushUrl = pushMock.mock.calls[0][0];
    expect(pushUrl).toContain('lat=13');
    expect(pushUrl).toContain('lng=77.5');
    expect(pushUrl).toContain('max_dist=5');
    expect(pushUrl).toContain('w_metro=0');
    expect(pushUrl).toContain('w_work=0');
    expect(pushUrl).toContain('w_cafe=1');
    expect(pushUrl).toContain('w_rest=1');
    expect(pushUrl).toContain('w_park=1');
    expect(pushUrl).toContain('w_health=1');
    expect(pushUrl).toContain('w_night=1');
  });

  it('does not append parameters if they match DEFAULT_STATE or are NaN', () => {
    const pushMock = (navigation as any).__getPushMock();
    const { result } = renderHook(() => useUrlState());
    
    act(() => {
      result.current.updateState({ lat: NaN, lng: NaN, max_dist: 15.0, w_metro: 1.0, w_work: 1.0, w_cafe: 0.0, w_restaurant: 0.0, w_park: 0.0, w_healthcare: 0.0, w_nightlife: 0.0 });
    });

    const pushUrl = pushMock.mock.calls[0][0];
    expect(pushUrl).toBe('/');
  });

  it('maintains determinism between state updates and URL generation (URL DETERMINISM)', () => {
    const pushMock = (navigation as any).__getPushMock();
    const { result, rerender } = renderHook(() => useUrlState());
    
    act(() => {
      result.current.updateState({ lat: 12.9, lng: 77.6 });
    });
    
    const pushUrl = pushMock.mock.calls[0][0];
    (navigation as any).__setSearchParams(pushUrl.split('?')[1] || '');
    rerender();
    
    expect(result.current.state.lat).toBe(12.9);
  });

  it('does not generate API request when coordinates are missing', () => {
    const { result } = renderHook(() => useUrlState());
    expect(result.current.getApiRequest()).toBeNull();
  });

  it('generates valid API request payload when state is populated', () => {
    (navigation as any).__setSearchParams('lat=12.9&lng=77.6&max_dist=20&w_metro=0.9&w_work=0.2&w_cafe=1&w_rest=0.5');
    const { result } = renderHook(() => useUrlState());
    
    const req = result.current.getApiRequest();
    expect(req).toEqual({
      work_location: { lat: 12.9, lng: 77.6 },
      constraints: { max_work_distance_km: 20 },
      preferences: { metro_access_weight: 0.9, short_commute_weight: 0.2, cafe_weight: 1, restaurant_weight: 0.5, park_weight: 0, healthcare_weight: 0, nightlife_weight: 0 }
    });
  });
});
