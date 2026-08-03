export interface WorkLocation {
  lat: number;
  lng: number;
}

export interface RecommendationConstraints {
  max_work_distance_km?: number | null;
  max_budget_inr?: number | null;
  bhk_type?: '1rk' | '1bhk' | '2bhk' | '3bhk' | null;
}

export interface RecommendationPreferences {
  metro_access_weight: number;
  short_commute_weight: number;
  cafe_weight: number;
  restaurant_weight: number;
  park_weight: number;
  healthcare_weight: number;
  nightlife_weight: number;
}

export interface RecommendationRequest {
  work_location: WorkLocation;
  constraints: RecommendationConstraints;
  preferences: RecommendationPreferences;
  limit?: number;
}

export interface ComponentScores {
  metro: number | null;
  work_distance: number;
  cafe: number | null;
  restaurant: number | null;
  park: number | null;
  healthcare: number | null;
  nightlife: number | null;
}

export interface RawMetrics {
  metro_distance_m: number | null;
  work_distance_km: number;
  cafe_accessibility: number | null;
  restaurant_accessibility: number | null;
  park_accessibility: number | null;
  healthcare_accessibility: number | null;
  nightlife_accessibility: number | null;
}

export interface RecommendationExplanations {
  pros: string[];
  warnings: string[];
}

export interface RecommendationResult {
  locality_id: number;
  slug: string;
  name: string;
  rank: number;
  total_score: number;
  component_scores: ComponentScores;
  raw_metrics: RawMetrics;
  metadata: {
    nearest_metro_station?: {
      name: string;
      slug: string;
    };
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  explanations: RecommendationExplanations;
}

export interface RecommendationProvenance {
  calc_versions_used: string[];
}

export interface RecommendationResponse {
  recommendations: RecommendationResult[];
  provenance: RecommendationProvenance;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export async function fetchRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/recommend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let errorMsg = 'Failed to fetch recommendations';
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // Ignored
    }
    throw new Error(errorMsg);
  }

  return response.json();
}
