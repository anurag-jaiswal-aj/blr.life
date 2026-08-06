'use client';

import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { MapPin, Search, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { AppState } from '../hooks/useUrlState';
import { searchPlaces, GeocodingResult } from '../lib/geocoding';

interface WorkLocationInputProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
  compact?: boolean;
}

export function WorkLocationInput({ state, updateState, compact = false }: WorkLocationInputProps) {
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

    const segments = result.display_name.split(',').map(s => s.trim());
    const shortName = segments.slice(0, 2).join(', ');

    setSelectedName(shortName);
    setQuery('');
    setResults([]);
    setShowResults(false);
    setHighlightedIndex(-1);
    setSearchError(null);

    // Feed into the SAME state as map click and manual coord entry
    updateState({ lat: result.lat, lng: result.lng, loc: shortName });
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
    updateState({ lat: null, lng: null, loc: undefined });
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
    <div className="w-full flex flex-col gap-3 relative" ref={containerRef}>
      {/* Header */}
      {!compact && (
        <div className="flex flex-col gap-1.5 mb-4 mt-1">
          <h1 className="text-[24px] lg:text-[26px] font-extrabold text-text-primary tracking-tight leading-tight">Where should you live in Bengaluru?</h1>
          <p className="text-[15px] font-medium text-text-secondary leading-snug">Find neighbourhoods around your workplace, ranked by distance to work and what matters to you.</p>
        </div>
      )}

      {/* Selected location badge */}
      {hasLocation && state.loc && (
        <div className={`flex items-center justify-between gap-2 bg-surface-app border border-border-strong rounded-control px-3 ${compact ? 'py-1.5' : 'py-2.5'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <MapPin size={16} className="text-text-secondary shrink-0" />
            <span className="text-body text-text-primary font-medium truncate" title={state.loc}>
              {state.loc}
            </span>
          </div>
          <button
            onClick={handleClearSelection}
            aria-label="Clear selected location"
            className="text-text-muted hover:text-text-primary shrink-0 transition-colors focus-visible:rounded-sm"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Map-click-only location indicator (no name known) */}
      {hasLocation && !state.loc && (
        <div className={`flex items-center justify-between gap-2 bg-surface-app border border-border-strong rounded-control px-3 ${compact ? 'py-1.5' : 'py-2.5'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <MapPin size={16} className="text-text-secondary shrink-0" />
            <span className="text-body text-text-primary font-medium">
              Custom Location ({state.lat?.toFixed(4)}, {state.lng?.toFixed(4)})
            </span>
          </div>
          <button
            onClick={handleClearSelection}
            aria-label="Clear selected location"
            className="text-text-muted hover:text-text-primary shrink-0 transition-colors focus-visible:rounded-sm"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search input with combobox role */}
      {(!compact || !hasLocation) && (
        <div className="relative">
          <div className="relative flex items-center">
            <label htmlFor={searchInputId} className="sr-only">Search for a work location</label>
            {searchLoading ? (
              <Loader2 size={18} className="absolute left-3 text-text-muted animate-spin pointer-events-none" />
            ) : (
              <Search size={18} className="absolute left-3 text-text-muted pointer-events-none" />
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
              className={`flex-1 bg-surface-primary border-2 border-border-strong rounded-l-md pl-10 pr-3 ${compact ? 'py-1.5 text-label' : 'py-3 text-[15px]'} outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary focus:ring-offset-1 min-w-0 placeholder:text-text-secondary transition-all`}
              placeholder={compact ? "Search location..." : "e.g. Koramangala, Manyata Tech Park…"}
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
              className={`px-6 ${compact ? 'py-1.5 text-label' : 'py-3 text-[15px]'} font-bold rounded-r-md focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1 transition-all ${
                searchLoading || query.trim().length < 2
                  ? 'bg-surface-secondary text-text-muted border-2 border-border-strong cursor-not-allowed'
                  : 'bg-brand-primary hover:bg-brand-hover text-text-inverse border-2 border-brand-primary cursor-pointer'
              }`}
            >
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Workflow reassurance */}
          {!compact && (
            <p className="mt-2 text-[12px] text-text-secondary leading-relaxed">
              Start with your workplace. You can tune metro access and lifestyle priorities after we find nearby neighbourhoods.
            </p>
          )}

          {/* Dropdown results */}
          {showResults && results.length > 0 && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Location suggestions"
              className="absolute z-50 mt-1 w-full bg-surface-primary border border-border-default rounded-card shadow-floating max-h-56 overflow-y-auto"
            >
              {results.map((result, index) => (
                <li
                  key={result.place_id}
                  id={`geocode-result-${index}`}
                  role="option"
                  aria-selected={highlightedIndex === index}
                  className={`px-4 py-3 cursor-pointer text-body border-b border-border-subtle last:border-b-0 ${
                    highlightedIndex === index
                      ? 'bg-surface-secondary text-brand-primary'
                      : 'text-text-primary hover:bg-surface-app'
                  }`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => {
                    // Use mousedown instead of click so it fires before onBlur
                    e.preventDefault();
                    handleSelectResult(result);
                  }}
                >
                  <div className="font-semibold truncate">{result.name}</div>
                  <div className="text-label text-text-muted truncate mt-0.5">{result.display_name}</div>
                </li>
              ))}
            </ul>
          )}

          {/* No results state */}
          {showResults && results.length === 0 && !searchLoading && !searchError && query.trim().length >= 2 && (
            <div className="absolute z-50 mt-1 w-full bg-surface-primary border border-border-default rounded-card shadow-floating px-4 py-4 text-body text-text-secondary">
              No locations found. Try a different name.
            </div>
          )}
        </div>
      )}

      {/* Search error */}
      {searchError && (
        <p className={`text-label text-error-text bg-error-bg p-2 rounded-md ${compact ? 'text-xs py-1 px-2' : ''}`} role="alert">{searchError}</p>
      )}

      {/* Manual coordinate toggle (Demoted to subtle tertiary link) */}
      {!compact && (
        <div className="mt-2 flex justify-start">
          <button
            onClick={() => setShowManual(!showManual)}
            className="text-[11px] font-medium text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded-sm"
          >
            Enter coordinates manually
          </button>
        </div>
      )}

      {/* Manual Input Form */}
      {!compact && showManual && (
        <div className="mt-1 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex gap-4 w-full">
            <div className="flex-1">
              <label htmlFor="latitude-input" className="block text-label font-medium text-text-secondary mb-1">
                Latitude
              </label>
              <input
                id="latitude-input"
                type="number"
                step="any"
                className="w-full bg-surface-primary border border-border-subtle rounded-control px-2.5 py-2 text-body outline-none focus:ring-2 focus:ring-brand-primary"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                onBlur={() => handleCoordUpdate(latInput, lngInput)}
                onKeyDown={(e) => e.key === 'Enter' && handleCoordUpdate(latInput, lngInput)}
                placeholder="e.g. 12.9716"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="longitude-input" className="block text-label font-medium text-text-secondary mb-1">
                Longitude
              </label>
              <input
                id="longitude-input"
                type="number"
                step="any"
                className="w-full bg-surface-primary border border-border-default rounded-control px-2.5 py-2 text-body outline-none focus:ring-2 focus:ring-brand-primary"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                onBlur={() => handleCoordUpdate(latInput, lngInput)}
                onKeyDown={(e) => e.key === 'Enter' && handleCoordUpdate(latInput, lngInput)}
                placeholder="e.g. 77.5946"
              />
            </div>
          </div>
          {coordError && <p className="text-label text-error-text bg-error-bg p-2 rounded-md border border-red-200" role="alert">{coordError}</p>}
        </div>
      )}

    </div>
  );
}
