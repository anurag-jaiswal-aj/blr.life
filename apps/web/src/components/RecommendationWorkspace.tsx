'use client';

import React, { useState, useEffect } from 'react';
import { useUrlState } from '../hooks/useUrlState';
import { useRecommendations } from '../hooks/useRecommendations';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { MapContainer } from '../components/MapContainer';
import { RecommendationList } from '../components/RecommendationList';
import { NeighbourhoodDetail } from '../components/NeighbourhoodDetail';
import { WorkLocationInput } from '../components/WorkLocationInput';
import { MobileRecommendationSheet } from '../components/MobileRecommendationSheet';
import { MobileControlsDisclosure } from '../components/MobileControlsDisclosure';
import { ShareButton } from '../components/ShareButton';
import { MapPin, SlidersHorizontal, Map as MapIcon, X } from 'lucide-react';

export function RecommendationWorkspace() {
  const { state, updateState, getApiRequest } = useUrlState();
  const request = getApiRequest();
  const { data, loading, error, isValidating, isColdStarting, retry } = useRecommendations(request);
  const { isDesktop, mounted } = useIsDesktop();
  const [selectedLocalityId, setSelectedLocalityId] = useState<number | null>(null);
  const [hoveredLocalityId, setHoveredLocalityId] = useState<number | null>(null);

  const hasLocation = state.lat !== null && state.lng !== null;

  // Reconcile selection state when recommendations change
  useEffect(() => {
    if (!data?.recommendations) return;
    
    if (data.recommendations.length === 0) {
      if (selectedLocalityId !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedLocalityId(null);
      }
      return;
    }

    const stillExists = data.recommendations.some(r => r.locality_id === selectedLocalityId);
    if (!stillExists) {
      setSelectedLocalityId(data.recommendations[0].locality_id);
    }
  }, [data?.recommendations, selectedLocalityId]);

  const handleWorkLocationSelect = (lat: number, lng: number) => {
    updateState({ lat, lng });
  };

  const selectedRecommendation = data?.recommendations.find(r => r.locality_id === selectedLocalityId) ?? null;

  // ─── HELPER: Empty State Content ───
  const renderSetupControls = () => (
    <div className="flex flex-col gap-5 p-4">
      {/* Search Input */}
      <div>
        <h2 className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.08em] mb-3">
          Workplace
        </h2>
        <WorkLocationInput state={state} updateState={updateState} compact={hasLocation} />
      </div>

      {/* Preference preview (Progressively Disclosed) */}
      {hasLocation && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <h2 className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.08em] mb-3">
            Rank By
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Commute', key: 'w_work' as const, value: state.w_work },
              { label: 'Metro', key: 'w_metro' as const, value: state.w_metro },
              { label: 'Cafes', key: 'w_cafe' as const, value: state.w_cafe },
              { label: 'Dining', key: 'w_restaurant' as const, value: state.w_restaurant },
              { label: 'Parks', key: 'w_park' as const, value: state.w_park },
              { label: 'Healthcare', key: 'w_healthcare' as const, value: state.w_healthcare },
              { label: 'Nightlife', key: 'w_nightlife' as const, value: state.w_nightlife },
            ].map(({ label, key, value }) => {
              const level = value >= 1.0 ? 'High' : value >= 0.5 ? 'Low' : 'Off';
              const nextValue = value >= 1.0 ? 0.0 : value >= 0.5 ? 1.0 : 0.5;
              const isActive = value > 0;
              return (
                <button
                  key={key}
                  onClick={() => updateState({ [key]: nextValue })}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium whitespace-nowrap ${
                    isActive
                      ? 'bg-brand-primary text-text-inverse border-brand-primary'
                      : 'bg-surface-primary text-text-secondary border-border-default hover:border-border-strong hover:text-text-primary'
                  }`}
                >
                  {label} · {level}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ─── WORKSPACE: 3-Pane Layout ───
  return (
    <div className="flex flex-col bg-surface-app text-text-primary font-sans h-[100dvh] overflow-hidden">
      
      {/* HEADER */}
      <header className={`flex items-center justify-between py-2.5 bg-surface-primary border-b border-border-default shrink-0 z-50 ${hasLocation ? 'px-4 md:px-6' : 'px-5 lg:px-8'}`}>
        <div className="flex items-center gap-4">
          <div className="text-[14px] font-bold text-brand-primary tracking-[0.15em] uppercase cursor-pointer" onClick={() => updateState({ lat: null, lng: null })}>
            blr.life
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasLocation && <ShareButton />}
        </div>
      </header>

      {/* TUNING BAR REMOVED: Now lives in Left Pane */}

      {/* MOBILE COMPACT HEADER */}
      {hasLocation && (
        <div className="lg:hidden flex items-center gap-3 px-4 py-2.5 bg-surface-primary border-b border-border-default z-10 shrink-0">
          <div className="flex-1 min-w-0 font-bold text-[13px] text-text-primary truncate">
            {state.loc || `Custom Location (${state.lat?.toFixed(4)}, ${state.lng?.toFixed(4)})`}
          </div>
        {mounted && !isDesktop && (
          <MobileControlsDisclosure state={state} updateState={updateState} />
          )}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col lg:flex-row w-full relative overflow-hidden">
        
        {/* Pane 1: Setup & Ranked List */}
        <section className={`hidden lg:flex shrink-0 h-full flex-col border-r border-border-default bg-surface-app z-10 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          hasLocation ? 'w-[320px] xl:w-[340px]' : 'w-[40%] max-w-[560px] min-w-[400px]'
        }`}>
          {/* ALWAYS show setup controls */}
          <div className={`shrink-0 border-border-default bg-surface-primary ${hasLocation ? 'border-b' : 'flex-1 flex flex-col justify-center px-4 pb-[15vh]'}`}>
            {renderSetupControls()}
          </div>

          {hasLocation && (
            <>
              <div className="px-4 py-3 border-b border-border-subtle shrink-0 flex items-center justify-between bg-surface-app">
                <h3 className="text-[13px] font-bold text-text-primary tracking-tight">
                  {`${data?.recommendations?.length ?? 0} results`}
                </h3>
                {isValidating && (
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                    Updating
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto bg-surface-app">
                {(!mounted || isDesktop) ? (
                  <RecommendationList 
                    data={data} 
                    loading={loading} 
                    error={error}
                    isColdStarting={isColdStarting}
                    selectedLocalityId={selectedLocalityId}
                    onSelect={setSelectedLocalityId}
                    onHover={setHoveredLocalityId}
                    onRetry={retry}
                  />
                ) : null}
              </div>
            </>
          )}
        </section>

        {/* Pane 2: Detail */}
        {hasLocation && (
          <section className="hidden lg:flex w-[360px] xl:w-[400px] shrink-0 h-full flex-col border-r border-border-default bg-surface-primary z-10 relative animate-in slide-in-from-left-4 fade-in duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
            {selectedRecommendation ? (
              <NeighbourhoodDetail recommendation={selectedRecommendation} />
            ) : (
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="text-[13px] text-text-muted text-center max-w-[250px]">
                  {loading ? 'Loading recommendations...' : 'Select a neighbourhood to see details'}
                </p>
              </div>
            )}
          </section>
        )}

        {/* Pane 3: Map */}
        <section className="flex-1 w-full h-full relative z-0">
          <MapContainer
            workLat={state.lat}
            workLng={state.lng}
            onWorkLocationSelect={handleWorkLocationSelect}
            recommendations={data?.recommendations || []}
            selectedLocalityId={selectedLocalityId}
            hoveredLocalityId={hoveredLocalityId}
            onRecommendationSelect={setSelectedLocalityId}
            isPreSearch={!hasLocation}
          />
        </section>
        
        {/* MOBILE Recommendation Sheet or Setup */}
        <div className="lg:hidden">
          {mounted && !isDesktop && (
            hasLocation ? (
              <MobileRecommendationSheet 
                data={data} 
                loading={loading} 
                error={error}
                isValidating={isValidating}
                isColdStarting={isColdStarting}
                selectedLocalityId={selectedLocalityId}
                onSelect={setSelectedLocalityId}
                onHover={setHoveredLocalityId}
                onRetry={retry}
              />
            ) : (
              <div className="absolute bottom-0 left-0 right-0 bg-surface-primary rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-40">
                <div className="w-full pt-4 pb-2 flex justify-center shrink-0">
                  <div className="w-12 h-1.5 bg-border-default rounded-full" />
                </div>
                <div className="px-2 pb-6">
                  {renderSetupControls()}
                </div>
              </div>
            )
          )}
        </div>

      </main>
    </div>
  );
}
