/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecommendationWorkspace } from './RecommendationWorkspace';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as urlState from '../hooks/useUrlState';
import * as recommendations from '../hooks/useRecommendations';

vi.mock('../hooks/useUrlState', () => ({
  useUrlState: vi.fn(),
}));

vi.mock('../hooks/useRecommendations', () => ({
  useRecommendations: vi.fn(),
}));

describe('RecommendationWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with assembled components', () => {
    vi.mocked(urlState.useUrlState).mockReturnValue({
      state: { lat: 12.0, lng: 77.0, max_dist: 15, w_metro: 1, w_work: 1, w_cafe: 0, w_restaurant: 0, w_park: 0, w_healthcare: 0, w_nightlife: 0 },
      updateState: vi.fn(),
      getApiRequest: vi.fn(),
    });

    vi.mocked(recommendations.useRecommendations).mockReturnValue({
      data: { recommendations: [], provenance: { calc_versions_used: [] } },
      loading: false,
      error: null,
    });

    render(<RecommendationWorkspace />);
    
    // ControlsPanel
    expect(screen.getByText('blr.life')).toBeInTheDocument();
    // RecommendationList
    expect(screen.getByText(/No localities found/i)).toBeInTheDocument();
    // MapContainer
    expect(screen.getByTestId('mock-map')).toBeInTheDocument();
  });
});
