'use client';

import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { MapPin, Search, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { AppState } from '../hooks/useUrlState';
import { searchPlaces, GeocodingResult } from '../lib/geocoding';

interface WorkLocationInputProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
}

export function WorkLocationInput({ state, updateState }: WorkLocationInputProps) {
  // --- Search state ---
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // --- Manual coordinate fallback state ---
  const [showManual, setShowManual] = useState(false);
  const [latInput, setLatInput] = useState(state.lat !== null ? String(state.lat) : '');
  const [lngInput, setLngInput] = useState(state.lng !== null ? String(state.lng) : '');
  const [coordError, setCoordError] = useState<string | null>(null);

  // Accessibility IDs
  const listboxId = useId();
  const searchInputId = useId();

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Track mounted state to avoid state updates after unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Sync lat/lng inputs when location is set externally (map click)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (state.lat !== null) setLatInput(String(state.lat));
    if (state.lng !== null) setLngInput(String(state.lng));
  }, [state.lat, state.lng]);

  // Close results when clicking outside the component
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const performSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      if (mountedRef.current) {
        setResults([]);
        setShowResults(false);
        setSearchLoading(false);
        setSearchError(null);
      }
      return;
    }

    if (!mountedRef.current) return;
    setSearchLoading(true);
    setSearchError(null);

    try {
      const found = await searchPlaces(trimmed);
      if (!mountedRef.current) return;
      setResults(found);
      setHighlightedIndex(-1);
      setShowResults(true);
    } catch (err) {
      if (!mountedRef.current) return;
      setSearchError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      setResults([]);
      setShowResults(false);
    } finally {
      if (mountedRef.current) setSearchLoading(false);
    }
  }, []);

  const handleSearchSubmit = () => {
    if (query.trim().length >= 2) {
      performSearch(query);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedName(null);
    setResults([]);
    setShowResults(false);
    setSearchError(null);
    setHighlightedIndex(-1);
  };

  const handleSelectResult = (result: GeocodingResult) => {
    // Validate the coordinates from the result before trusting them
    if (
      isNaN(result.lat) || isNaN(result.lng) ||
      result.lat < -90 || result.lat > 90 ||
      result.lng < -180 || result.lng > 180
    ) {
      setSearchError('Invalid coordinates returned. Please try a different location.');
      return;
    }

    setSelectedName(result.display_name);
    setQuery('');
    setResults([]);
    setShowResults(false);
    setHighlightedIndex(-1);
    setSearchError(null);

    // Feed into the SAME state as map click and manual coord entry
    updateState({ lat: result.lat, lng: result.lng });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || results.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearchSubmit();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          handleSelectResult(results[highlightedIndex]);
        } else {
          handleSearchSubmit();
        }
        break;
      case 'Escape':
        setShowResults(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleClearSelection = () => {
    setSelectedName(null);
    setQuery('');
    setResults([]);
    setShowResults(false);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  // --- Manual coordinate entry (existing behaviour preserved) ---
  const handleCoordUpdate = (newLatStr: string, newLngStr: string) => {
    setCoordError(null);
    if (!newLatStr && !newLngStr) return;

    const parsedLat = parseFloat(newLatStr);
    const parsedLng = parseFloat(newLngStr);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setCoordError('Please enter valid numerical coordinates.');
      return;
    }
    if (parsedLat < -90 || parsedLat > 90) {
      setCoordError('Latitude must be between -90 and 90.');
      return;
    }
    if (parsedLng < -180 || parsedLng > 180) {
      setCoordError('Longitude must be between -180 and 180.');
      return;
    }

    setSelectedName(null);
    updateState({ lat: parsedLat, lng: parsedLng });
  };

  const hasLocation = state.lat !== null && state.lng !== null;

  return (
    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex flex-col gap-3" ref={containerRef}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <MapPin className="text-blue-500 shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-sm font-semibold text-blue-900">Where do you work?</p>
          <p className="text-xs text-blue-700 mt-1">Search for a place, or click the map.</p>
        </div>
      </div>

      {/* Selected location badge */}
      {hasLocation && selectedName && (
        <div className="flex items-center justify-between gap-2 bg-blue-100 border border-blue-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin size={14} className="text-blue-600 shrink-0" />
            <span className="text-xs text-blue-800 font-medium truncate" title={selectedName}>
              {selectedName}
            </span>
          </div>
          <button
            onClick={handleClearSelection}
            aria-label="Clear selected location"
            className="text-blue-400 hover:text-blue-700 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Map-click-only location indicator (no name known) */}
      {hasLocation && !selectedName && (
        <div className="flex items-center gap-2 bg-blue-100 border border-blue-200 rounded-lg px-3 py-2">
          <MapPin size={14} className="text-blue-600 shrink-0" />
          <span className="text-xs text-blue-800 font-medium">
            Location set ({state.lat?.toFixed(4)}, {state.lng?.toFixed(4)})
          </span>
        </div>
      )}

      {/* Search input with combobox role */}
      <div className="relative">
        <div className="relative flex items-center">
          <label htmlFor={searchInputId} className="sr-only">Search for a work location</label>
          {searchLoading ? (
            <Loader2 size={16} className="absolute left-2.5 text-blue-400 animate-spin pointer-events-none" />
          ) : (
            <Search size={16} className="absolute left-2.5 text-blue-400 pointer-events-none" />
          )}
          <input
            ref={searchInputRef}
            id={searchInputId}
            role="combobox"
            aria-expanded={showResults && results.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={highlightedIndex >= 0 ? `geocode-result-${highlightedIndex}` : undefined}
            type="text"
            className="flex-1 bg-white border border-blue-200 rounded-l-lg pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
            placeholder="e.g. Koramangala, Manyata Tech Park…"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleSearchKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={handleSearchSubmit}
            disabled={searchLoading || query.trim().length < 2}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm font-medium rounded-r-lg border border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Search
          </button>
        </div>

        {/* Dropdown results */}
        {showResults && results.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Location suggestions"
            className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto"
          >
            {results.map((result, index) => (
              <li
                key={result.place_id}
                id={`geocode-result-${index}`}
                role="option"
                aria-selected={highlightedIndex === index}
                className={`px-3 py-2.5 cursor-pointer text-sm border-b border-gray-50 last:border-b-0 ${
                  highlightedIndex === index
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-800 hover:bg-gray-50'
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => {
                  // Use mousedown instead of click so it fires before onBlur
                  e.preventDefault();
                  handleSelectResult(result);
                }}
              >
                <div className="font-medium truncate">{result.name}</div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{result.display_name}</div>
              </li>
            ))}
          </ul>
        )}

        {/* No results state */}
        {showResults && results.length === 0 && !searchLoading && !searchError && query.trim().length >= 2 && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-3 text-sm text-gray-500">
            No locations found. Try a different name.
          </div>
        )}
      </div>

      {/* Search error */}
      {searchError && (
        <p className="text-xs text-red-600" role="alert">{searchError}</p>
      )}

      {/* Manual coordinate toggle */}
      <button
        onClick={() => setShowManual(prev => !prev)}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 self-start"
        aria-expanded={showManual}
      >
        {showManual ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Enter coordinates manually
      </button>

      {/* Manual coordinate inputs (collapsible, existing behaviour preserved) */}
      {showManual && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 w-full">
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
                onBlur={() => handleCoordUpdate(latInput, lngInput)}
                onKeyDown={(e) => e.key === 'Enter' && handleCoordUpdate(latInput, lngInput)}
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
                onBlur={() => handleCoordUpdate(latInput, lngInput)}
                onKeyDown={(e) => e.key === 'Enter' && handleCoordUpdate(latInput, lngInput)}
                placeholder="e.g. 77.5946"
              />
            </div>
          </div>
          {coordError && <p className="text-xs text-red-600" role="alert">{coordError}</p>}
        </div>
      )}

      {/* OSM attribution (required by Nominatim policy / ODbL) */}
      <p className="text-[10px] text-blue-500/70 mt-1">
        Search powered by{' '}
        <a
          href="https://nominatim.openstreetmap.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-600"
        >
          Nominatim
        </a>
        {' '}·{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-600"
        >
          © OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
