
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkLocationInput } from './WorkLocationInput';
import { AppState } from '../hooks/useUrlState';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import * as geocodingModule from '../lib/geocoding';

describe('WorkLocationInput', () => {
  const defaultState: AppState = {
    lat: null,
    lng: null,
    max_dist: 10,
    max_budget_inr: null,
    bhk_type: null,
    w_metro: 1,
    w_work: 1,
    w_cafe: 1,
    w_restaurant: 1,
    w_park: 1,
    w_healthcare: 1,
    w_nightlife: 1,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Search Functionality', () => {
    it('renders search input with accessible semantic labels', () => {
      render(<WorkLocationInput state={defaultState} updateState={vi.fn()} />);
      expect(screen.getByLabelText(/Search for a work location/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Search/i })).toBeInTheDocument();
    });

    it('typing alone DOES NOT call geocoding', async () => {
      const searchSpy = vi.spyOn(geocodingModule, 'searchPlaces').mockResolvedValue([]);
      render(<WorkLocationInput state={defaultState} updateState={vi.fn()} />);
      
      const searchInput = screen.getByRole('combobox');
      await userEvent.type(searchInput, 'bangalore');
      
      expect(searchSpy).not.toHaveBeenCalled();
    });

    it('does not trigger search for queries shorter than 2 characters when Search is clicked', async () => {
      const searchSpy = vi.spyOn(geocodingModule, 'searchPlaces').mockResolvedValue([]);
      render(<WorkLocationInput state={defaultState} updateState={vi.fn()} />);
      
      const searchInput = screen.getByRole('combobox');
      await userEvent.type(searchInput, 'a');
      
      const searchBtn = screen.getByRole('button', { name: /Search/i });
      expect(searchBtn).toBeDisabled();
      
      expect(searchSpy).not.toHaveBeenCalled();
    });

    it('displays search results and allows selection via explicit Search button click', async () => {
      const mockResults = [
        { place_id: 1, lat: 12.9716, lng: 77.5946, display_name: 'Bangalore, India', name: 'Bangalore' },
        { place_id: 2, lat: 12.9352, lng: 77.6245, display_name: 'Koramangala, Bangalore, India', name: 'Koramangala' },
      ];
      vi.spyOn(geocodingModule, 'searchPlaces').mockResolvedValue(mockResults);
      const updateSpy = vi.fn();
      
      render(<WorkLocationInput state={defaultState} updateState={updateSpy} />);
      
      const searchInput = screen.getByRole('combobox');
      await userEvent.type(searchInput, 'bangalore');
      
      const searchBtn = screen.getByRole('button', { name: /Search/i });
      await userEvent.click(searchBtn);
      
      // Wait for results to render
      await waitFor(() => {
        expect(screen.getByText('Bangalore, India')).toBeInTheDocument();
      });
      
      // Click the second result
      const option = screen.getByText('Koramangala, Bangalore, India');
      fireEvent.mouseDown(option); // Component uses mousedown
      
      expect(updateSpy).toHaveBeenCalledWith({ lat: 12.9352, lng: 77.6245 });
    });

    it('displays search results and allows selection via Enter key', async () => {
      const mockResults = [
        { place_id: 1, lat: 12.9716, lng: 77.5946, display_name: 'Bangalore, India', name: 'Bangalore' }
      ];
      vi.spyOn(geocodingModule, 'searchPlaces').mockResolvedValue(mockResults);
      const updateSpy = vi.fn();
      
      render(<WorkLocationInput state={defaultState} updateState={updateSpy} />);
      
      const searchInput = screen.getByRole('combobox');
      await userEvent.type(searchInput, 'bangalore{enter}');
      
      await waitFor(() => {
        expect(screen.getByText('Bangalore, India')).toBeInTheDocument();
      });
      
      const option = screen.getByText('Bangalore, India');
      fireEvent.mouseDown(option);
      
      expect(updateSpy).toHaveBeenCalledWith({ lat: 12.9716, lng: 77.5946 });
    });

    it('shows error state when search fails', async () => {
      vi.spyOn(geocodingModule, 'searchPlaces').mockRejectedValue(new Error('Network error'));
      render(<WorkLocationInput state={defaultState} updateState={vi.fn()} />);
      
      const searchInput = screen.getByRole('combobox');
      await userEvent.type(searchInput, 'fail{enter}');
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Network error/i);
      });
    });

    it('shows no results state when empty array returned', async () => {
      vi.spyOn(geocodingModule, 'searchPlaces').mockResolvedValue([]);
      render(<WorkLocationInput state={defaultState} updateState={vi.fn()} />);
      
      const searchInput = screen.getByRole('combobox');
      await userEvent.type(searchInput, 'nowhere{enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/No locations found/i)).toBeInTheDocument();
      });
    });

    it('editing query after results does not auto-fetch and hides existing results', async () => {
      const searchSpy = vi.spyOn(geocodingModule, 'searchPlaces').mockResolvedValue([{
        place_id: 1, lat: 12.9, lng: 77.5, display_name: 'Test Display Name', name: 'Test Name'
      }]);
      render(<WorkLocationInput state={defaultState} updateState={vi.fn()} />);
      
      const searchInput = screen.getByRole('combobox');
      await userEvent.type(searchInput, 'test{enter}');
      
      await waitFor(() => {
        expect(screen.getByText('Test Name')).toBeInTheDocument();
      });
      
      expect(searchSpy).toHaveBeenCalledTimes(1);
      
      // Editing query should hide results immediately and not fetch again
      await userEvent.type(searchInput, 'ing');
      
      expect(screen.queryByText('Test Name')).not.toBeInTheDocument();
      expect(searchSpy).toHaveBeenCalledTimes(1); // No new request
    });

    it('clears selected location and resets state on clear button click', async () => {
      const updateSpy = vi.fn();
      
      // Need to use the component's internal state mechanism or provide selectedName via a mock
      // Actually, if lat/lng are present but selectedName is null, it shows "Location set (12.9700, 77.5900)"
      // Let's mock a search and selection to get the selectedName set, then clear it.
      const mockResults = [
        { place_id: 1, lat: 12.9716, lng: 77.5946, display_name: 'Bangalore, India', name: 'Bangalore' }
      ];
      vi.spyOn(geocodingModule, 'searchPlaces').mockResolvedValue(mockResults);
      
      const { rerender } = render(<WorkLocationInput state={defaultState} updateState={updateSpy} />);
      
      const searchInput = screen.getByRole('combobox');
      await userEvent.type(searchInput, 'bangalore{enter}');
      
      await waitFor(() => {
        expect(screen.getByText('Bangalore, India')).toBeInTheDocument();
      });
      
      const option = screen.getByText('Bangalore, India');
      fireEvent.mouseDown(option);
      
      expect(updateSpy).toHaveBeenCalledWith({ lat: 12.9716, lng: 77.5946 });

      // Rerender with new state to simulate parent update
      rerender(<WorkLocationInput state={{ ...defaultState, lat: 12.9716, lng: 77.5946 }} updateState={updateSpy} />);

      // Now clear button should be visible
      const clearBtn = screen.getByRole('button', { name: /Clear selected location/i });
      await userEvent.click(clearBtn);

      expect(updateSpy).toHaveBeenCalledWith({ lat: null, lng: null });
    });
  });

  describe('Manual Coordinate Input', () => {
    const openManualInputs = async () => {
      const toggle = screen.getByText(/Enter coordinates manually/i);
      await userEvent.click(toggle);
    };

    it('populates manual fields if state already has coordinates', async () => {
      const state = { ...defaultState, lat: 12.97, lng: 77.59 };
      render(<WorkLocationInput state={state} updateState={vi.fn()} />);
      
      await openManualInputs();
      
      expect(screen.getByLabelText(/Latitude/i)).toHaveValue(12.97);
      expect(screen.getByLabelText(/Longitude/i)).toHaveValue(77.59);
    });

    it('calls updateState with valid manually entered coordinates on blur', async () => {
      const updateSpy = vi.fn();
      render(<WorkLocationInput state={defaultState} updateState={updateSpy} />);
      
      await openManualInputs();
      
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
      
      await openManualInputs();
      
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
      
      await openManualInputs();
      
      const latInput = screen.getByLabelText(/Latitude/i);
      
      await userEvent.type(latInput, '12.'); // incomplete/invalid depending on parsing
      fireEvent.blur(latInput);
      
      expect(updateSpy).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
