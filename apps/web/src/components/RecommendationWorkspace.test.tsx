import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecommendationWorkspace } from "./RecommendationWorkspace";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as urlState from "../hooks/useUrlState";
import * as recommendations from "../hooks/useRecommendations";
import * as isDesktopHook from "../hooks/useIsDesktop";
import { RecommendationResult } from "../lib/api";

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("../hooks/useUrlState", () => ({
  useUrlState: vi.fn(),
}));

vi.mock("../hooks/useRecommendations", () => ({
  useRecommendations: vi.fn(),
}));

vi.mock("../hooks/useIsDesktop", () => ({
  useIsDesktop: vi.fn(),
}));

describe("RecommendationWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDesktopHook.useIsDesktop).mockReturnValue({
      isDesktop: true,
      mounted: true,
    });
  });

  it("renders the workspace with assembled components when location is set", () => {
    const defaultState = {
      lat: 12.9716,
      lng: 77.5946,
      max_dist: 5,
      max_budget_inr: null,
      bhk_type: null,
      w_metro: 0.5,
      w_work: 0.5,
      w_cafe: 0.5,
      w_restaurant: 0.5,
      w_park: 0.5,
      w_healthcare: 0.5,
      w_nightlife: 0.5,
      loc: null,
      saved_ids: [],
      compare_ids: [],
    };
    vi.mocked(urlState.useUrlState).mockReturnValue({
      state: defaultState,
      updateState: vi.fn(),
      getApiRequest: vi.fn(),
    });

    vi.mocked(recommendations.useRecommendations).mockReturnValue({
      data: { recommendations: [], provenance: { calc_versions_used: [] } },
      loading: false,
      error: null,
      isValidating: false,
      isColdStarting: false,
      retry: vi.fn(),
    });

    render(<RecommendationWorkspace />);

    // Header present
    expect(screen.getByText("blr.life")).toBeInTheDocument();
    // Share button present
    expect(
      screen.getByRole("button", { name: /Share results/i }),
    ).toBeInTheDocument();
    // Map present
    expect(screen.getByTestId("mock-map")).toBeInTheDocument();
    // No localities message
    expect(screen.getAllByText(/No localities found/i).length).toBeGreaterThan(
      0,
    );
  });

  it("renders the first-visit empty state when coordinates are missing", () => {
    const emptyState = {
      lat: null,
      lng: null,
      max_dist: 5,
      max_budget_inr: null,
      bhk_type: null,
      w_metro: 0.5,
      w_work: 0.5,
      w_cafe: 0.5,
      w_restaurant: 0.5,
      w_park: 0.5,
      w_healthcare: 0.5,
      w_nightlife: 0.5,
      loc: null,
      saved_ids: [],
      compare_ids: [],
    };

    vi.mocked(urlState.useUrlState).mockReturnValue({
      state: emptyState,
      updateState: vi.fn(),
      getApiRequest: vi.fn(),
    });

    vi.mocked(recommendations.useRecommendations).mockReturnValue({
      data: null,
      loading: false,
      error: null,
      isValidating: false,
      isColdStarting: false,
      retry: vi.fn(),
    });

    render(<RecommendationWorkspace />);

    // First-visit heading is now in WorkLocationInput
    expect(
      screen.getByText(/Find neighbourhoods around your workplace/i),
    ).toBeInTheDocument();

    // Preference chips are progressively disclosed (hidden initially)
    expect(screen.queryByText(/Commute · Low/i)).not.toBeInTheDocument();
    // Map should BE present in the empty state now
    expect(screen.queryByTestId("mock-map")).toBeInTheDocument();
  });

  it("renders the desktop Refine action in the desktop workspace and opens controls", () => {
    vi.mocked(isDesktopHook.useIsDesktop).mockReturnValue({
      isDesktop: true,
      mounted: true,
    });

    const defaultState: urlState.AppState = {
      lat: 12.9716,
      lng: 77.5946,
      max_dist: 5,
      max_budget_inr: null,
      bhk_type: null,
      w_metro: 0.5,
      w_work: 0.5,
      w_cafe: 0.5,
      w_restaurant: 0.5,
      w_park: 0.5,
      w_healthcare: 0.5,
      w_nightlife: 0.5,
      loc: null,
      saved_ids: [],
      compare_ids: [],
    };
    vi.mocked(urlState.useUrlState).mockReturnValue({
      state: defaultState,
      updateState: vi.fn(),
      getApiRequest: vi.fn(),
    });

    vi.mocked(recommendations.useRecommendations).mockReturnValue({
      data: { recommendations: [], provenance: { calc_versions_used: [] } },
      loading: false,
      error: null,
      isValidating: false,
      isColdStarting: false,
      retry: vi.fn(),
    });

    render(<RecommendationWorkspace />);

    const refineButton = screen.getByRole("button", { name: /Refine/i });
    expect(refineButton).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: /Refine recommendations/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(refineButton);

    expect(
      screen.getByRole("heading", { name: /Refine recommendations/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Budget & Home")).toBeInTheDocument();
  });

  it("renders mobile-specific layout components without duplicating desktop ones when on mobile", () => {
    vi.mocked(isDesktopHook.useIsDesktop).mockReturnValue({
      isDesktop: false,
      mounted: true,
    });

    const defaultState = {
      lat: 12.9716,
      lng: 77.5946,
      max_dist: 5,
      max_budget_inr: null,
      bhk_type: null,
      w_metro: 0.5,
      w_work: 0.5,
      w_cafe: 0.5,
      w_restaurant: 0.5,
      w_park: 0.5,
      w_healthcare: 0.5,
      w_nightlife: 0.5,
      loc: null,
      saved_ids: [],
      compare_ids: [],
    };
    vi.mocked(urlState.useUrlState).mockReturnValue({
      state: defaultState,
      updateState: vi.fn(),
      getApiRequest: vi.fn(),
    });

    vi.mocked(recommendations.useRecommendations).mockReturnValue({
      data: { recommendations: [], provenance: { calc_versions_used: [] } },
      loading: false,
      error: null,
      isValidating: false,
      isColdStarting: false,
      retry: vi.fn(),
    });

    render(<RecommendationWorkspace />);

    // Mobile controls present
    expect(screen.getByRole("button", { name: /refine/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /expand recommendations/i }),
    ).toBeInTheDocument();
  });

  it("renders desktop-specific layout components without mobile ones when on desktop", () => {
    vi.mocked(isDesktopHook.useIsDesktop).mockReturnValue({
      isDesktop: true,
      mounted: true,
    });

    const defaultState = {
      lat: 12.9716,
      lng: 77.5946,
      max_dist: 5,
      max_budget_inr: null,
      bhk_type: null,
      w_metro: 0.5,
      w_work: 0.5,
      w_cafe: 0.5,
      w_restaurant: 0.5,
      w_park: 0.5,
      w_healthcare: 0.5,
      w_nightlife: 0.5,
      loc: null,
      saved_ids: [],
      compare_ids: [],
    };
    vi.mocked(urlState.useUrlState).mockReturnValue({
      state: defaultState,
      updateState: vi.fn(),
      getApiRequest: vi.fn(),
    });

    vi.mocked(recommendations.useRecommendations).mockReturnValue({
      data: { recommendations: [], provenance: { calc_versions_used: [] } },
      loading: false,
      error: null,
      isValidating: false,
      isColdStarting: false,
      retry: vi.fn(),
    });

    render(<RecommendationWorkspace />);

    // Refine button SHOULD be present on desktop now
    expect(screen.getByRole("button", { name: /refine/i })).toBeInTheDocument();
    // Mobile recommendation sheet toggle should NOT be present
    expect(
      screen.queryByRole("button", { name: /expand recommendations/i }),
    ).not.toBeInTheDocument();
    // Desktop tuning bar has preference chips
    expect(screen.getByText(/Commute · Low/i)).toBeInTheDocument();
  });

  it("selects the first recommendation by default when results arrive", () => {
    vi.mocked(isDesktopHook.useIsDesktop).mockReturnValue({
      isDesktop: true,
      mounted: true,
    });
    vi.mocked(urlState.useUrlState).mockReturnValue({
      state: { lat: 12.9, lng: 77.6, max_dist: 5, saved_ids: [], compare_ids: [] } as unknown as urlState.AppState,
      updateState: vi.fn(),
      getApiRequest: vi.fn(),
    });

    const mockRecs = [
      {
        locality_id: 101,
        name: "First Rec",
        rank: 1,
        total_score: 90,
        component_scores: {
          metro: null,
          work_distance: 0.9,
          cafe: null,
          restaurant: null,
          park: null,
          healthcare: null,
          nightlife: null,
        },
        raw_metrics: {
          work_distance_km: 1,
          metro_distance_m: null,
          cafe_accessibility: null,
          restaurant_accessibility: null,
          park_accessibility: null,
          healthcare_accessibility: null,
          nightlife_accessibility: null,
        },
        explanations: { pros: [], warnings: [] },
        metadata: { coordinates: { lat: 12.9, lng: 77.6 } },
      },
      {
        locality_id: 102,
        name: "Second Rec",
        rank: 2,
        total_score: 80,
        component_scores: {
          metro: null,
          work_distance: 0.8,
          cafe: null,
          restaurant: null,
          park: null,
          healthcare: null,
          nightlife: null,
        },
        raw_metrics: {
          work_distance_km: 2,
          metro_distance_m: null,
          cafe_accessibility: null,
          restaurant_accessibility: null,
          park_accessibility: null,
          healthcare_accessibility: null,
          nightlife_accessibility: null,
        },
        explanations: { pros: [], warnings: [] },
        metadata: { coordinates: { lat: 12.8, lng: 77.5 } },
      },
    ];

    vi.mocked(recommendations.useRecommendations).mockReturnValue({
      data: {
        recommendations: mockRecs as unknown as RecommendationResult[],
        provenance: { calc_versions_used: [] },
      },
      loading: false,
      error: null,
      isValidating: false,
      isColdStarting: false,
      retry: vi.fn(),
    });

    render(<RecommendationWorkspace />);

    // The first card should have aria-pressed="true"
    const firstCard = screen
      .getAllByText("First Rec")[0]
      .closest('[role="button"]');
    const secondCard = screen
      .getAllByText("Second Rec")[0]
      .closest('[role="button"]');

    expect(firstCard).toHaveAttribute("aria-pressed", "true");
    expect(secondCard).toHaveAttribute("aria-pressed", "false");
  });

  it("prevents selecting more than 4 localities for comparison", () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const updateStateMock = vi.fn();
    const defaultState = {
      lat: 12.97,
      lng: 77.59,
      max_dist: 15,
      max_budget_inr: null,
      bhk_type: null,
      w_metro: 1,
      w_work: 1,
      w_cafe: 1,
      w_restaurant: 1,
      w_park: 1,
      w_healthcare: 1,
      w_nightlife: 1,
      loc: null,
      saved_ids: [],
      compare_ids: [100, 200, 300, 400],
    };

    vi.mocked(urlState.useUrlState).mockReturnValue({
      state: defaultState,
      updateState: updateStateMock,
      getApiRequest: vi.fn(),
    });

    vi.mocked(recommendations.useRecommendations).mockReturnValue({
      data: {
        recommendations: [
          {
            locality_id: 500,
            name: "Fifth Rec",
            rank: 5,
            total_score: 50,
            score_contributions: {},
            component_scores: {},
            raw_metrics: {},
            metadata: {},
            affordability: null,
            explanations: { pros: [], warnings: [] },
          } as unknown as RecommendationResult,
        ],
        provenance: { calc_versions_used: [] },
      },
      loading: false,
      error: null,
      isValidating: false,
      isColdStarting: false,
      retry: vi.fn(),
    });

    render(<RecommendationWorkspace />);

    // Try to compare the 5th locality
    const compareBtn = screen.getAllByRole("button", { name: /Add Fifth Rec to comparison/i })[0];
    fireEvent.click(compareBtn);

    // It should alert the user and NOT call updateState
    expect(alertMock).toHaveBeenCalledWith(
      "You can compare up to 4 localities at a time. Please remove one before adding another."
    );
    expect(updateStateMock).not.toHaveBeenCalled();

    alertMock.mockRestore();
  });

  it("allows clearing comparison selection without affecting save behavior", () => {
    const updateStateMock = vi.fn();
    const defaultState = {
      lat: 12.97,
      lng: 77.59,
      max_dist: 15,
      max_budget_inr: null,
      bhk_type: null,
      w_metro: 1,
      w_work: 1,
      w_cafe: 1,
      w_restaurant: 1,
      w_park: 1,
      w_healthcare: 1,
      w_nightlife: 1,
      loc: null,
      saved_ids: [100, 200],
      compare_ids: [100, 300],
    };

    vi.mocked(urlState.useUrlState).mockReturnValue({
      state: defaultState,
      updateState: updateStateMock,
      getApiRequest: vi.fn(),
    });

    vi.mocked(recommendations.useRecommendations).mockReturnValue({
      data: { recommendations: [], provenance: { calc_versions_used: [] } },
      loading: false,
      error: null,
      isValidating: false,
      isColdStarting: false,
      retry: vi.fn(),
    });

    render(<RecommendationWorkspace />);

    // Clear comparison
    const clearBtn = screen.getByRole("button", { name: /Clear comparison selection/i });
    fireEvent.click(clearBtn);

    expect(updateStateMock).toHaveBeenCalledWith(
      { compare_ids: [] },
      { history: "replace" }
    );
  });
});
