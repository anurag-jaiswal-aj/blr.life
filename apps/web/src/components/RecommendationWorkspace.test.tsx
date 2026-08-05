
import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecommendationWorkspace } from './RecommendationWorkspace';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as urlState from '../hooks/useUrlState';
import * as recommendations from '../hooks/useRecommendations';
import * as isDesktopHook from '../hooks/useIsDesktop';

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('../hooks/useUrlState', () => ({
  useUrlState: vi.fn(),
}));

vi.mock('../hooks/useRecommendations', () => ({
  useRecommendations: vi.fn(),
}));

vi.mock('../hooks/useIsDesktop', () => ({
  useIsDesktop: vi.fn(),
}));

describe('RecommendationWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDesktopHook.useIsDesktop).mockReturnValue({ isDesktop: true, mounted: true });
  });

  it('renders correctly with assembled components', () => {
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
    
    // ControlsPanel
    expect(screen.getByText('blr.life')).toBeInTheDocument();
    // RecommendationList
    expect(screen.getAllByText(/No localities found/i).length).toBeGreaterThan(0);
    // MapContainer
    expect(screen.getByTestId('mock-map')).toBeInTheDocument();
  });

  it('renders only the work location input when coordinates are missing', () => {
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
    
    // WorkLocationInput should be present
    expect(screen.getByLabelText(/Search for a work location/i)).toBeInTheDocument();
    
    // ControlsPanel and Map should NOT be present
    expect(screen.queryByLabelText(/Maximum Commute Distance/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-map')).not.toBeInTheDocument();
  });

  it('renders mobile-specific layout components without duplicating desktop ones when on mobile', () => {
    vi.mocked(isDesktopHook.useIsDesktop).mockReturnValue({ isDesktop: false, mounted: true });

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
    
    // Check that Mobile Controls Disclosure "Refine" button is present
    expect(screen.getByRole('button', { name: /refine/i })).toBeInTheDocument();
    
    // Check that Mobile Recommendation Sheet is present (it has the "Expand recommendations" button)
    expect(screen.getByRole('button', { name: /expand recommendations/i })).toBeInTheDocument();

    // Verify desktop ControlsPanel is NOT rendered (doesn't have Maximum Commute Distance visible)
    // Wait, the MobileControlsDisclosure only renders ControlsPanel inside a dialog when opened.
    // So initially, ControlsPanel should not be in the document at all on mobile!
    expect(screen.queryByLabelText(/Maximum Commute Distance/i)).not.toBeInTheDocument();
  });

  it('renders desktop-specific layout components without mobile ones when on desktop', () => {
    vi.mocked(isDesktopHook.useIsDesktop).mockReturnValue({ isDesktop: true, mounted: true });

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
    
    // Mobile controls should NOT be present
    expect(screen.queryByRole('button', { name: /refine/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /expand recommendations/i })).not.toBeInTheDocument();

    // Desktop ControlsPanel should be present
    expect(screen.getByLabelText(/Maximum Commute Distance/i)).toBeInTheDocument();
  });
  it('selects the first recommendation by default when results arrive', () => {
    vi.mocked(isDesktopHook.useIsDesktop).mockReturnValue({ isDesktop: true, mounted: true });
    vi.mocked(urlState.useUrlState).mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state: { lat: 12.9, lng: 77.6, max_dist: 5 } as any,
      updateState: vi.fn(),
      getApiRequest: vi.fn(),
    });

    const mockRecs = [
      { locality_id: 101, name: 'First Rec', rank: 1, total_score: 90, component_scores: { metro: null }, raw_metrics: { work_distance_km: 1, metro_distance_m: null }, explanations: { pros: [], warnings: [] }, metadata: { coordinates: { lat: 12.9, lng: 77.6 } } },
      { locality_id: 102, name: 'Second Rec', rank: 2, total_score: 80, component_scores: { metro: null }, raw_metrics: { work_distance_km: 2, metro_distance_m: null }, explanations: { pros: [], warnings: [] }, metadata: { coordinates: { lat: 12.8, lng: 77.5 } } }
    ];

    vi.mocked(recommendations.useRecommendations).mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { recommendations: mockRecs as any, provenance: { calc_versions_used: [] } },
      loading: false,
      error: null,
      isValidating: false,
      isColdStarting: false,
      retry: vi.fn(),
    });

    render(<RecommendationWorkspace />);
    
    // The first card should have aria-pressed="true"
    const firstCard = screen.getByText('First Rec').closest('[role="button"]');
    const secondCard = screen.getByText('Second Rec').closest('[role="button"]');
    
    expect(firstCard).toHaveAttribute('aria-pressed', 'true');
    expect(secondCard).toHaveAttribute('aria-pressed', 'false');
  });
});
