/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ResultCard } from './ResultCard';
import { describe, it, expect } from 'vitest';

describe('ResultCard', () => {
  const mockResult: any = {
    locality_id: 1,
    slug: 'hsr',
    name: 'HSR Layout',
    rank: 1,
    total_score: 85,
    component_scores: { metro: null, work_distance: 100 },
    raw_metrics: { metro_distance_m: null, work_distance_km: 2.5 },
    metadata: { coordinates: { lat: 12.9, lng: 77.6 } },
    explanations: {
      pros: ['Close to work'],
      warnings: ['Low confidence data']
    }
  };

  it('renders correctly with missing metro data (MISSING METRIC)', () => {
    render(<ResultCard result={mockResult} />);
    
    expect(screen.getByText('HSR Layout')).toBeInTheDocument();
    expect(screen.getByText(/2.5 km commute/i)).toBeInTheDocument();
    expect(screen.getByText(/— metro/i)).toBeInTheDocument();
  });

  it('renders metro distance when available', () => {
    const validResult = { ...mockResult, component_scores: { metro: 90, work_distance: 100 }, raw_metrics: { metro_distance_m: 500, work_distance_km: 2.5 } };
    render(<ResultCard result={validResult} />);
    
    expect(screen.getByText(/500 m/i)).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });
});
