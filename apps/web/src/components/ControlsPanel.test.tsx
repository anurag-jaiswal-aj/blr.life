/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ControlsPanel } from './ControlsPanel';
import { AppState } from '../hooks/useUrlState';
import { describe, it, expect, vi } from 'vitest';

describe('ControlsPanel (CONTROLS)', () => {
  const defaultState: AppState = { lat: 12.97, lng: 77.59, max_dist: 15, w_metro: 1, w_work: 1 };

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

  it('renders only the coordinate inputs via WorkLocationInput when coordinates are missing', () => {
    render(<ControlsPanel state={{ ...defaultState, lat: null, lng: null }} updateState={vi.fn()} />);
    expect(screen.getByLabelText(/Latitude/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Maximum Commute Distance/i)).not.toBeInTheDocument();
  });
});
