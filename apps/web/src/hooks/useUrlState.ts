import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { RecommendationRequest } from '../lib/api';

export interface AppState {
  lat: number | null;
  lng: number | null;
  max_dist: number;
  w_metro: number;
  w_work: number;
  w_cafe: number;
  w_restaurant: number;
  w_park: number;
  w_healthcare: number;
  w_nightlife: number;
  max_budget_inr: number | null;
  bhk_type: '1rk' | '1bhk' | '2bhk' | '3bhk' | null;
}

const DEFAULT_STATE: AppState = {
  lat: null,
  lng: null,
  max_dist: 15.0,
  w_metro: 1.0,
  w_work: 1.0,
  w_cafe: 0.0,
  w_restaurant: 0.0,
  w_park: 0.0,
  w_healthcare: 0.0,
  w_nightlife: 0.0,
  max_budget_inr: null,
  bhk_type: null,
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
    const wCafeStr = searchParams.get('w_cafe');
    const wRestaurantStr = searchParams.get('w_rest');
    const wParkStr = searchParams.get('w_park');
    const wHealthcareStr = searchParams.get('w_health');
    const wNightlifeStr = searchParams.get('w_night');

    const maxBudgetStr = searchParams.get('max_budget');
    const bhkTypeStr = searchParams.get('bhk');

    let lat = latStr ? parseFloat(latStr) : DEFAULT_STATE.lat;
    let lng = lngStr ? parseFloat(lngStr) : DEFAULT_STATE.lng;
    let max_dist = maxDistStr ? parseFloat(maxDistStr) : DEFAULT_STATE.max_dist;
    let w_metro = wMetroStr ? parseFloat(wMetroStr) : DEFAULT_STATE.w_metro;
    let w_work = wWorkStr ? parseFloat(wWorkStr) : DEFAULT_STATE.w_work;
    let w_cafe = wCafeStr ? parseFloat(wCafeStr) : DEFAULT_STATE.w_cafe;
    let w_restaurant = wRestaurantStr ? parseFloat(wRestaurantStr) : DEFAULT_STATE.w_restaurant;
    let w_park = wParkStr ? parseFloat(wParkStr) : DEFAULT_STATE.w_park;
    let w_healthcare = wHealthcareStr ? parseFloat(wHealthcareStr) : DEFAULT_STATE.w_healthcare;
    let w_nightlife = wNightlifeStr ? parseFloat(wNightlifeStr) : DEFAULT_STATE.w_nightlife;
    let max_budget_inr = maxBudgetStr ? parseInt(maxBudgetStr, 10) : DEFAULT_STATE.max_budget_inr;
    let bhk_type = (bhkTypeStr as '1rk' | '1bhk' | '2bhk' | '3bhk' | null) || DEFAULT_STATE.bhk_type;

    if (lat !== null && isNaN(lat)) lat = null;
    if (lng !== null && isNaN(lng)) lng = null;
    if (isNaN(max_dist) || max_dist <= 0) max_dist = DEFAULT_STATE.max_dist;
    if (isNaN(w_metro) || w_metro < 0 || w_metro > 1) w_metro = DEFAULT_STATE.w_metro;
    if (isNaN(w_work) || w_work < 0 || w_work > 1) w_work = DEFAULT_STATE.w_work;
    if (isNaN(w_cafe) || w_cafe < 0 || w_cafe > 1) w_cafe = DEFAULT_STATE.w_cafe;
    if (isNaN(w_restaurant) || w_restaurant < 0 || w_restaurant > 1) w_restaurant = DEFAULT_STATE.w_restaurant;
    if (isNaN(w_park) || w_park < 0 || w_park > 1) w_park = DEFAULT_STATE.w_park;
    if (isNaN(w_healthcare) || w_healthcare < 0 || w_healthcare > 1) w_healthcare = DEFAULT_STATE.w_healthcare;
    if (isNaN(w_nightlife) || w_nightlife < 0 || w_nightlife > 1) w_nightlife = DEFAULT_STATE.w_nightlife;
    if (max_budget_inr !== null && (isNaN(max_budget_inr) || max_budget_inr < 1000)) max_budget_inr = null;
    if (bhk_type !== null && !['1rk', '1bhk', '2bhk', '3bhk'].includes(bhk_type)) bhk_type = null;

    return { lat, lng, max_dist, w_metro, w_work, w_cafe, w_restaurant, w_park, w_healthcare, w_nightlife, max_budget_inr, bhk_type: bhk_type as AppState['bhk_type'] };
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
      if (merged.w_cafe !== DEFAULT_STATE.w_cafe) params.set('w_cafe', merged.w_cafe.toString());
      if (merged.w_restaurant !== DEFAULT_STATE.w_restaurant) params.set('w_rest', merged.w_restaurant.toString());
      if (merged.w_park !== DEFAULT_STATE.w_park) params.set('w_park', merged.w_park.toString());
      if (merged.w_healthcare !== DEFAULT_STATE.w_healthcare) params.set('w_health', merged.w_healthcare.toString());
      if (merged.w_nightlife !== DEFAULT_STATE.w_nightlife) params.set('w_night', merged.w_nightlife.toString());
      if (merged.max_budget_inr !== null && !isNaN(merged.max_budget_inr)) params.set('max_budget', merged.max_budget_inr.toString());
      if (merged.bhk_type !== null) params.set('bhk', merged.bhk_type);

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [state, pathname, router]
  );

  const getApiRequest = useCallback((): RecommendationRequest | null | undefined => {
    if (state.lat === null || state.lng === null) return null;

    const isBudgetIncomplete = (state.max_budget_inr !== null && state.bhk_type === null) || 
                               (state.max_budget_inr === null && state.bhk_type !== null);
    if (isBudgetIncomplete) return undefined;

    const constraints: RecommendationRequest['constraints'] = { max_work_distance_km: state.max_dist };
    if (state.max_budget_inr !== null && state.bhk_type !== null) {
      constraints.max_budget_inr = state.max_budget_inr;
      constraints.bhk_type = state.bhk_type;
    }

    return {
      work_location: { lat: state.lat, lng: state.lng },
      constraints,
      preferences: { 
        metro_access_weight: state.w_metro, 
        short_commute_weight: state.w_work,
        cafe_weight: state.w_cafe,
        restaurant_weight: state.w_restaurant,
        park_weight: state.w_park,
        healthcare_weight: state.w_healthcare,
        nightlife_weight: state.w_nightlife,
      },
    };
  }, [state]);

  return { state, updateState, getApiRequest };
}
