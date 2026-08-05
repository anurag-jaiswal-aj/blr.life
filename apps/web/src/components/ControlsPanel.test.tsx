
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ControlsPanel } from './ControlsPanel';
import { AppState } from '../hooks/useUrlState';
import { describe, it, expect, vi } from 'vitest';

describe('ControlsPanel (CONTROLS)', () => {
  const defaultState: AppState = {
    lat: 12.97,
    lng: 77.59,
    max_dist: 15,
    max_budget_inr: null,
    bhk_type: null,
    w_metro: 1,
    w_work: 1,
    w_cafe: 0,
    w_restaurant: 0,
    w_park: 0,
    w_healthcare: 0,
    w_nightlife: 0,
  };

  it('renders preference controls when coordinates are present', () => {
    render(<ControlsPanel state={defaultState} updateState={vi.fn()} />);
    expect(screen.getByLabelText(/Maximum Commute Distance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Metro Importance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Short Commute Importance/i)).toBeInTheDocument();
  });

  it('updates state when sliders are changed', () => {
    const updateSpy = vi.fn();
    render(<ControlsPanel state={defaultState} updateState={updateSpy} />);
    
    fireEvent.change(screen.getByLabelText(/Maximum Commute Distance/i), { target: { value: '20' } });
    expect(updateSpy).toHaveBeenCalledWith({ max_dist: 20 });
    
    fireEvent.change(screen.getByLabelText(/Metro Importance Weight/i), { target: { value: '0.5' } });
    expect(updateSpy).toHaveBeenCalledWith({ w_metro: 0.5 });
    
    fireEvent.change(screen.getByLabelText(/Short Commute Importance Weight/i), { target: { value: '0.8' } });
    expect(updateSpy).toHaveBeenCalledWith({ w_work: 0.8 });
  });

  // WorkLocationInput is now rendered in RecommendationWorkspace

  it('updates amenity priorities when lifestyle accordion is toggled and selectors clicked', () => {
    const updateSpy = vi.fn();
    const { getByText } = render(<ControlsPanel state={defaultState} updateState={updateSpy} />);
    
    fireEvent.click(getByText('Lifestyle Preferences'));
    
    const cafeLabel = getByText('Cafes').parentElement;
    if (cafeLabel) {
      const mustBtn = cafeLabel.querySelectorAll('button')[2];
      fireEvent.click(mustBtn);
      expect(updateSpy).toHaveBeenCalledWith({ w_cafe: 1.0 });
    }
    
    const diningLabel = getByText('Dining').parentElement;
    if (diningLabel) {
      const niceBtn = diningLabel.querySelectorAll('button')[1];
      fireEvent.click(niceBtn);
      expect(updateSpy).toHaveBeenCalledWith({ w_restaurant: 0.5 });
    }
  });
});
