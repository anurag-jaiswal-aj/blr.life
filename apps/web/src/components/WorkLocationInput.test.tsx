/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkLocationInput } from './WorkLocationInput';
import { AppState } from '../hooks/useUrlState';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

describe('WorkLocationInput (COORDINATE INPUT & ACCESSIBILITY)', () => {
  const defaultState: AppState = { lat: null, lng: null, max_dist: 15, w_metro: 1, w_work: 1, w_cafe: 0, w_restaurant: 0, w_park: 0, w_healthcare: 0, w_nightlife: 0 };

  it('renders input fields with accessible semantic labels', () => {
    render(<WorkLocationInput state={defaultState} updateState={vi.fn()} />);
    expect(screen.getByLabelText(/Latitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Longitude/i)).toBeInTheDocument();
  });

  it('populates fields if state already has coordinates', () => {
    const state = { ...defaultState, lat: 12.97, lng: 77.59 };
    render(<WorkLocationInput state={state} updateState={vi.fn()} />);
    expect(screen.getByLabelText(/Latitude/i)).toHaveValue(12.97);
    expect(screen.getByLabelText(/Longitude/i)).toHaveValue(77.59);
  });

  it('calls updateState with valid manually entered coordinates on blur', async () => {
    const updateSpy = vi.fn();
    render(<WorkLocationInput state={defaultState} updateState={updateSpy} />);
    
    const latInput = screen.getByLabelText(/Latitude/i);
    const lngInput = screen.getByLabelText(/Longitude/i);
    
    await userEvent.type(latInput, '12.9716');
    await userEvent.type(lngInput, '77.5946');
    fireEvent.blur(lngInput);
    
    expect(updateSpy).toHaveBeenCalledWith({ lat: 12.9716, lng: 77.5946 });
  });

  it('shows error and blocks update for out-of-range coordinates', async () => {
    const updateSpy = vi.fn();
    render(<WorkLocationInput state={defaultState} updateState={updateSpy} />);
    
    const latInput = screen.getByLabelText(/Latitude/i);
    const lngInput = screen.getByLabelText(/Longitude/i);
    
    await userEvent.type(latInput, '95'); // Invalid lat
    await userEvent.type(lngInput, '77');
    fireEvent.blur(lngInput);
    
    expect(updateSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Latitude must be between/i);
  });

  it('shows error for non-numerical or incomplete input', async () => {
    const updateSpy = vi.fn();
    render(<WorkLocationInput state={defaultState} updateState={updateSpy} />);
    
    const latInput = screen.getByLabelText(/Latitude/i);
    
    await userEvent.type(latInput, '12.'); // incomplete/invalid depending on parsing, but say we leave lng empty
    fireEvent.blur(latInput);
    
    expect(updateSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
