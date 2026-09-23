/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultCard } from './ResultCard';
import { describe, it, expect, vi } from 'vitest';

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
    expect(screen.getByText(/2.5 km away/i)).toBeInTheDocument();
    expect(screen.getByText(/— metro/i)).toBeInTheDocument();
  });

  it('renders metro distance when available', () => {
    const validResult = { ...mockResult, component_scores: { metro: 90, work_distance: 100 }, raw_metrics: { metro_distance_m: 500, work_distance_km: 2.5 } };
    render(<ResultCard result={validResult} />);
    
    expect(screen.getByText(/500 m/i)).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('renders affordable status', () => {
    const affordableResult = { ...mockResult, affordability: { status: 'affordable', rent_min_inr: 15000, rent_max_inr: 20000, confidence: 'high' } };
    render(<ResultCard result={affordableResult} />);
    expect(screen.getByText(/Within budget/i)).toBeInTheDocument();
    expect(screen.getByText(/15,000/i)).toBeInTheDocument();
  });

  it('renders starts_within_budget status', () => {
    const startsResult = { ...mockResult, affordability: { status: 'starts_within_budget', rent_min_inr: 18000, rent_max_inr: 25000, confidence: 'high' } };
    render(<ResultCard result={startsResult} />);
    expect(screen.getByText(/Starts within budget/i)).toBeInTheDocument();
  });

  it('renders over_budget status', () => {
    const overResult = { ...mockResult, affordability: { status: 'over_budget', rent_min_inr: 25000, rent_max_inr: 30000, confidence: 'high' } };
    render(<ResultCard result={overResult} />);
    expect(screen.getByText(/Over budget/i)).toBeInTheDocument();
  });

  it('renders unknown status', () => {
    const unknownResult = { ...mockResult, affordability: { status: 'unknown', rent_min_inr: null, rent_max_inr: null, confidence: null } };
    render(<ResultCard result={unknownResult} />);
    expect(screen.getByText(/Rent unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/We only show verified rent data/i)).toBeInTheDocument();
  });

  it('renders LOW confidence as estimate', () => {
    const estResult = { ...mockResult, affordability: { status: 'affordable', rent_min_inr: 15000, rent_max_inr: 20000, confidence: 'low' } };
    render(<ResultCard result={estResult} />);
    expect(screen.getByText(/\(Est\.\)/i)).toBeInTheDocument();
  });

  it('supports compare toggle and reflects state', () => {
    const mockOnToggleCompare = vi.fn();
    const { rerender } = render(<ResultCard result={mockResult} onToggleCompare={mockOnToggleCompare} isCompared={false} />);
    const compareBtn = screen.getByLabelText(/Add HSR Layout to comparison/i);
    fireEvent.click(compareBtn);
    expect(mockOnToggleCompare).toHaveBeenCalledWith(1);

    rerender(<ResultCard result={mockResult} onToggleCompare={mockOnToggleCompare} isCompared={true} />);
    const activeCompareBtn = screen.getByLabelText(/Remove HSR Layout from comparison/i);
    expect(activeCompareBtn).toBeInTheDocument();
  });
});
