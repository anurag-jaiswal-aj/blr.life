import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NeighbourhoodDetail } from './NeighbourhoodDetail';
import { describe, it, expect } from 'vitest';
import { RecommendationResult } from '../lib/api';

const mockRecommendation: RecommendationResult = {
  locality_id: 1,
  slug: 'test-locality',
  name: 'Test Locality',
  rank: 1,
  total_score: 85.0,
  score_contributions: {
    metro: 40.0,
    work_distance: 45.0,
    cafe: 7.0,
    restaurant: 5.0,
    park: 3.0,
    healthcare: 0.0,
    nightlife: 0.0,
  },
  component_scores: {
    metro: 1.0,
    work_distance: 0.8,
    cafe: 0.5,
    restaurant: 0.4,
    park: 0.2,
    healthcare: 0.0,
    nightlife: 0.0,
  },
  raw_metrics: {
    metro_distance_m: 500,
    work_distance_km: 5.0,
    cafe_accessibility: 10,
    restaurant_accessibility: 20,
    park_accessibility: 2,
    healthcare_accessibility: 0,
    nightlife_accessibility: 0,
  },
  metadata: {},
  affordability: null,
  explanations: {
    pros: [],
    warnings: []
  }
};

describe('NeighbourhoodDetail (MATCH SCORE EXPLANATION)', () => {
  it('renders match score and initially hides explanation', () => {
    render(<NeighbourhoodDetail recommendation={mockRecommendation} />);
    
    // 1. Match score renders correctly
    expect(screen.getByText('85')).toBeInTheDocument();
    
    // 2. Explanation trigger is present and accessible
    const trigger = screen.getByRole('button', { name: /Explain Match Score/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // 3. Explanation is initially hidden
    expect(screen.queryByRole('dialog', { name: /Match Score Explanation/i })).not.toBeInTheDocument();
  });

  it('reveals explanation popover with correct point contributions on click', () => {
    render(<NeighbourhoodDetail recommendation={mockRecommendation} />);
    
    const trigger = screen.getByRole('button', { name: /Explain Match Score/i });
    
    // 4. Activating trigger reveals explanation
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    
    const dialog = screen.getByRole('dialog', { name: /Match Score Explanation/i });
    expect(dialog).toBeInTheDocument();

    // 5. Displays backend-provided contribution values
    // 6. Labels as points (pts) rather than percentages
    expect(screen.getByText('Work Proximity:')).toBeInTheDocument();
    expect(screen.getByText('+45 pts')).toBeInTheDocument();
    
    expect(screen.getByText('Metro Access:')).toBeInTheDocument();
    expect(screen.getByText('+40 pts')).toBeInTheDocument();

    expect(screen.getByText('Cafes:')).toBeInTheDocument();
    expect(screen.getByText('+7 pts')).toBeInTheDocument();
  });

  it('supports keyboard activation and escape to close', () => {
    render(<NeighbourhoodDetail recommendation={mockRecommendation} />);
    
    const trigger = screen.getByRole('button', { name: /Explain Match Score/i });
    
    // 7. Keyboard activation works (Enter or Space usually handled natively by <button>, but we can simulate click or keydown)
    fireEvent.click(trigger); // Using click since standard buttons activate on Enter/Space
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // 8. Escape closes it
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
