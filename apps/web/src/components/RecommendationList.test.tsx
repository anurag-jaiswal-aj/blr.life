/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { RecommendationList } from './RecommendationList';
import { describe, it, expect } from 'vitest';

describe('RecommendationList (RESULTS & STATES)', () => {
  it('renders loading state correctly (LOADING STATE)', () => {
    render(<RecommendationList data={null} loading={true} error={null} />);
    expect(screen.getAllByRole('generic').some(el => el.className.includes('animate-pulse'))).toBe(true);
  });

  it('renders API error state securely (API ERROR STATE)', () => {
    render(<RecommendationList data={null} loading={false} error="Internal Server Error" />);
    expect(screen.getByText(/Error fetching recommendations/i)).toBeInTheDocument();
    expect(screen.getByText(/Internal Server Error/i)).toBeInTheDocument();
  });

  it('renders empty state intentionally when 0 recommendations (EMPTY STATE)', () => {
    const data = { recommendations: [], provenance: { calc_versions_used: ['v1'] } };
    render(<RecommendationList data={data} loading={false} error={null} />);
    expect(screen.getByText(/No localities found/i)).toBeInTheDocument();
  });

  it('renders success state with missing metrics and warnings safely (SUCCESS STATE, MISSING METRIC, WARNINGS, CONFIDENCE)', () => {
    const mockData: any = {
      recommendations: [
        {
          locality_id: 1,
          slug: 'hsr',
          name: 'HSR Layout',
          rank: 1,
          total_score: 95,
          component_scores: { metro: null, work_distance: 100 },
          raw_metrics: { metro_distance_m: null, work_distance_km: 2.5 },
          metadata: { coordinates: { lat: 12.9, lng: 77.6 } },
          explanations: {
            pros: ['Close to work'],
            warnings: ['Low confidence data']
          }
        }
      ],
      provenance: { calc_versions_used: ['v1'] }
    };

    render(<RecommendationList data={mockData} loading={false} error={null} />);
    
    // Success State rendering
    expect(screen.getByText('HSR Layout')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument(); // total_score
    expect(screen.getByText(/2.5 km/i)).toBeInTheDocument();
    
    // Missing Data
    expect(screen.getByText(/Unavailable/i)).toBeInTheDocument(); // metro is null
    
    // Explanations/Warnings
    expect(screen.getByText('Close to work')).toBeInTheDocument();
    expect(screen.getByText('Low confidence data')).toBeInTheDocument();
  });
});
