import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ControlsDisclosure } from './ControlsDisclosure';
import { AppState } from '../hooks/useUrlState';

describe('ControlsDisclosure', () => {
  const defaultState: AppState = {
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
  };

  it('renders the Refine button', () => {
    render(<ControlsDisclosure state={defaultState} updateState={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Refine/i })).toBeInTheDocument();
  });

  it('opens the controls modal when clicked and renders into portal', () => {
    const { baseElement } = render(<ControlsDisclosure state={defaultState} updateState={vi.fn()} />);
    
    expect(screen.queryByRole('heading', { name: /Refine recommendations/i })).not.toBeInTheDocument();
    
    fireEvent.click(screen.getByRole('button', { name: /Refine/i }));
    
    expect(screen.getByRole('heading', { name: /Refine recommendations/i })).toBeInTheDocument();
    expect(screen.getByText('Budget & Home')).toBeInTheDocument();
    
    const modalContainer = baseElement.querySelector('.z-\\[100\\]');
    expect(modalContainer).toBeInTheDocument();
    expect(modalContainer?.parentElement).toBe(document.body);
    
    fireEvent.click(screen.getByLabelText('Close filters'));
    expect(screen.queryByRole('heading', { name: /Refine recommendations/i })).not.toBeInTheDocument();
  });
});
