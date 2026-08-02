import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { RecommendationRequest } from '../lib/api';

export interface AppState {
  lat: number | null;
  lng: number | null;
  max_dist: number;
  w_metro: number;
  w_work: number;
}

const DEFAULT_STATE: AppState = {
  lat: null,
  lng: null,
  max_dist: 15.0,
  w_metro: 1.0,
  w_work: 1.0,
};

export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo<AppState>(() => {
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const maxDistStr = searchParams.get('max_dist');
    const wMetroStr = searchParams.get('w_metro');
    const wWorkStr = searchParams.get('w_work');

    let lat = latStr ? parseFloat(latStr) : DEFAULT_STATE.lat;
    let lng = lngStr ? parseFloat(lngStr) : DEFAULT_STATE.lng;
    let max_dist = maxDistStr ? parseFloat(maxDistStr) : DEFAULT_STATE.max_dist;
    let w_metro = wMetroStr ? parseFloat(wMetroStr) : DEFAULT_STATE.w_metro;
    let w_work = wWorkStr ? parseFloat(wWorkStr) : DEFAULT_STATE.w_work;

    if (lat !== null && isNaN(lat)) lat = null;
    if (lng !== null && isNaN(lng)) lng = null;
    if (isNaN(max_dist) || max_dist <= 0) max_dist = DEFAULT_STATE.max_dist;
    if (isNaN(w_metro) || w_metro < 0 || w_metro > 1) w_metro = DEFAULT_STATE.w_metro;
    if (isNaN(w_work) || w_work < 0 || w_work > 1) w_work = DEFAULT_STATE.w_work;

    return { lat, lng, max_dist, w_metro, w_work };
  }, [searchParams]);

  const updateState = useCallback(
    (newState: Partial<AppState>) => {
      const merged = { ...state, ...newState };
      const params = new URLSearchParams();

      if (merged.lat !== null && !isNaN(merged.lat)) params.set('lat', merged.lat.toString());
      if (merged.lng !== null && !isNaN(merged.lng)) params.set('lng', merged.lng.toString());
      if (merged.max_dist !== DEFAULT_STATE.max_dist) params.set('max_dist', merged.max_dist.toString());
      if (merged.w_metro !== DEFAULT_STATE.w_metro) params.set('w_metro', merged.w_metro.toString());
      if (merged.w_work !== DEFAULT_STATE.w_work) params.set('w_work', merged.w_work.toString());

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [state, pathname, router]
  );

  const getApiRequest = useCallback((): RecommendationRequest | null => {
    if (state.lat === null || state.lng === null) return null;
    return {
      work_location: { lat: state.lat, lng: state.lng },
      constraints: { max_work_distance_km: state.max_dist },
      preferences: { metro_access_weight: state.w_metro, short_commute_weight: state.w_work },
    };
  }, [state]);

  return { state, updateState, getApiRequest };
}
