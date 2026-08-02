import React, { useState, useEffect } from 'react';
import { AppState } from '../hooks/useUrlState';
import { MapPin } from 'lucide-react';

interface WorkLocationInputProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
}

export function WorkLocationInput({ state, updateState }: WorkLocationInputProps) {
  const [latInput, setLatInput] = useState(state.lat !== null ? String(state.lat) : '');
  const [lngInput, setLngInput] = useState(state.lng !== null ? String(state.lng) : '');
  const [error, setError] = useState<string | null>(null);

  // Sync from state to local input if state changes externally (e.g., map click)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.lat !== null) setLatInput(String(state.lat));
    if (state.lng !== null) setLngInput(String(state.lng));
  }, [state.lat, state.lng]);

  const handleUpdate = (newLatStr: string, newLngStr: string) => {
    setError(null);
    if (!newLatStr && !newLngStr) {
      // Both empty is fine, though we shouldn't wipe map marker unless allowed, but let's say it's fine
      return;
    }
    const parsedLat = parseFloat(newLatStr);
    const parsedLng = parseFloat(newLngStr);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setError('Please enter valid numerical coordinates.');
      return;
    }
    if (parsedLat < -90 || parsedLat > 90) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (parsedLng < -180 || parsedLng > 180) {
      setError('Longitude must be between -180 and 180.');
      return;
    }

    updateState({ lat: parsedLat, lng: parsedLng });
  };

  return (
    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <MapPin className="text-blue-500 shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-sm font-semibold text-blue-900">Where do you work?</p>
          <p className="text-xs text-blue-700 mt-1">Click the map or enter coordinates.</p>
        </div>
      </div>
      
      <div className="flex gap-2 w-full mt-2">
        <div className="flex-1">
          <label htmlFor="latitude-input" className="block text-xs font-medium text-blue-900 mb-1">
            Latitude
          </label>
          <input
            id="latitude-input"
            type="number"
            step="any"
            className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            onBlur={() => handleUpdate(latInput, lngInput)}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate(latInput, lngInput)}
            placeholder="e.g. 12.9716"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="longitude-input" className="block text-xs font-medium text-blue-900 mb-1">
            Longitude
          </label>
          <input
            id="longitude-input"
            type="number"
            step="any"
            className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            onBlur={() => handleUpdate(latInput, lngInput)}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate(latInput, lngInput)}
            placeholder="e.g. 77.5946"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-1" role="alert">{error}</p>}
    </div>
  );
}
