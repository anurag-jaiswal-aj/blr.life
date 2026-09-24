export interface WorkLocation {
  lat: number;
  lng: number;
}

export interface RecommendationConstraints {
  max_work_distance_km?: number | null;
  max_budget_inr?: number | null;
  bhk_type?: "1rk" | "1bhk" | "2bhk" | "3bhk" | null;
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
  include_locality_ids?: number[];
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

export type AffordabilityStatus =
  "affordable" | "starts_within_budget" | "over_budget" | "unknown";

export interface AffordabilityInfo {
  status: AffordabilityStatus;
  rent_min_inr: number | null;
  rent_max_inr: number | null;
  confidence: string | null;
}

// Ensure global GeoJSON types are used
import type { Geometry } from "geojson";

export interface RecommendationResult {
  locality_id: number;
  slug: string;
  name: string;
  rank: number;
  total_score: number;
  score_contributions: ComponentScores;
  component_scores: ComponentScores;
  raw_metrics: RawMetrics;
  metadata: {
    nearest_metro_station?: {
      name: string;
      slug: string;
      line?: string;
    };
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  affordability: AffordabilityInfo | null;
  explanations: RecommendationExplanations;
  geometry_geojson?: Geometry | null;
}

export interface RecommendationProvenance {
  calc_versions_used: string[];
}

export interface RecommendationResponse {
  recommendations: RecommendationResult[];
  provenance: RecommendationProvenance;
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function fetchRecommendations(
  request: RecommendationRequest,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/recommend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    let errorMsg = "Failed to fetch recommendations";
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        if (typeof errorData.detail === "string") {
          errorMsg = errorData.detail;
        } else {
          console.error("Backend validation error:", errorData.detail);
          errorMsg = "Invalid request parameters provided.";
        }
      }
    } catch {
      // Ignored
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

// ------------------------------------------------------------------
// Locality Static/Read API
// ------------------------------------------------------------------

export interface LocalityListItem {
  id: number;
  name: string;
  slug: string;
  parent_zone: string | null;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MetroInfo {
  station_name: string;
  station_slug: string | null;
  line: string | null;
  distance_m: number;
}

export interface AmenityCounts {
  cafes: number | null;
  restaurants: number | null;
  parks: number | null;
  healthcare: number | null;
  nightlife: number | null;
}

export interface RentInfo {
  min_inr: number | null;
  max_inr: number | null;
  confidence: string;
}

export interface LocalityDetailResponse {
  id: number;
  name: string;
  slug: string;
  parent_zone: string | null;
  centroid: Coordinates;
  geometry_geojson?: Geometry | null;
  metro: MetroInfo | null;
  amenities: AmenityCounts;
  rent: RentInfo | null;
}

export async function fetchLocalities(): Promise<LocalityListItem[]> {
  // Use absolute URL for server-side fetching, or default to localhost if not set.
  // Next.js will cache this request by default for static generation unless disabled.
  const response = await fetch(`${API_BASE_URL}/api/v1/localities`, {
    next: { tags: ["localities"] },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch localities: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchLocalityDetail(
  slug: string,
): Promise<LocalityDetailResponse | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/localities/${slug}`, {
    next: { tags: [`locality-${slug}`] },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch locality ${slug}: ${response.statusText}`);
  }

  return response.json();
}
