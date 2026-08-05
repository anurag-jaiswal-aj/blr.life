'use client';

import React, { useState, useEffect } from 'react';
import { useUrlState } from '../hooks/useUrlState';
import { useRecommendations } from '../hooks/useRecommendations';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { MapContainer } from '../components/MapContainer';
import { ControlsPanel } from '../components/ControlsPanel';
import { RecommendationList } from '../components/RecommendationList';
import { WorkLocationInput } from '../components/WorkLocationInput';
import { MobileRecommendationSheet } from '../components/MobileRecommendationSheet';
import { MobileControlsDisclosure } from '../components/MobileControlsDisclosure';

export function RecommendationWorkspace() {
  const { state, updateState, getApiRequest } = useUrlState();
  const request = getApiRequest();
  const { data, loading, error } = useRecommendations(request);
  const { isDesktop, mounted } = useIsDesktop();
  const [selectedLocalityId, setSelectedLocalityId] = useState<number | null>(null);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedLocalityId(data.recommendations[0].locality_id);
    }
  }, [data?.recommendations, selectedLocalityId]);

  const handleWorkLocationSelect = (lat: number, lng: number) => {
    updateState({ lat, lng });
  };

  const hasLocation = state.lat !== null && state.lng !== null;

  return (
    <div className={`flex flex-col bg-surface-app text-text-primary font-sans ${hasLocation ? 'h-[100dvh] overflow-hidden lg:h-auto lg:min-h-screen' : 'min-h-screen'}`}>
      {/* HEADER */}
      <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-surface-primary border-b border-border-default sticky top-0 z-50 shrink-0">
        <div className="text-wordmark font-bold text-brand-primary tracking-tight">blr.life</div>
        <div className="text-label font-medium text-text-muted uppercase tracking-widest hidden sm:block">Bengaluru neighbourhoods</div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 flex flex-col w-full mx-auto ${hasLocation ? 'lg:pb-12 h-full' : 'pb-12'}`}>
        
        {/* PRODUCT INTRO & PRIMARY TASK (Hidden on mobile if location is set) */}
        <section className={`px-4 md:px-8 max-w-4xl w-full shrink-0 ${hasLocation ? 'py-3 lg:py-8 lg:block hidden' : 'py-8 md:py-12 block'}`}>
          <div className={`${hasLocation ? 'hidden lg:block' : ''}`}>
            <h1 className="text-heading md:text-3xl font-bold text-brand-primary tracking-tight mb-2">
              Find the Bengaluru neighbourhood that fits your life.
            </h1>
            <p className="text-body text-text-secondary mb-8 max-w-2xl">
              Start with where you work. We&apos;ll help narrow where to live.
            </p>
          </div>
          
          <div className="max-w-xl">
            <WorkLocationInput state={state} updateState={updateState} />
          </div>
        </section>

        {/* MOBILE COMPACT HEADER (Only visible on mobile when location is set) */}
        {hasLocation && (
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-surface-primary border-b border-border-default z-10 shrink-0">
            <div className="flex-1 min-w-0">
              <WorkLocationInput state={state} updateState={updateState} compact={true} />
            </div>
            {mounted && !isDesktop && (
              <MobileControlsDisclosure state={state} updateState={updateState} />
            )}
          </div>
        )}

        {/* WORKSPACE (Controls, Results, Map) */}
        {hasLocation && (
          <section className="flex-1 px-4 md:px-8 flex flex-col gap-6 w-full relative h-full lg:mt-0">
            
            {/* DESKTOP CONTROLS AREA */}
            <div className="hidden lg:block w-full">
              <h2 className="text-card-title font-semibold text-text-primary mb-3">Refine recommendations</h2>
              {(!mounted || isDesktop) && <ControlsPanel state={state} updateState={updateState} />}
            </div>

            {/* RESULTS & MAP AREA */}
            {/* On desktop: map is flex-1. On mobile: map takes full remaining height (flex-1), and we remove the gap/padding so it's edge-to-edge */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 lg:min-h-[600px] lg:mt-2 -mx-4 md:-mx-8 lg:mx-0 h-full relative">
              
              {/* DESKTOP Recommendation List */}
              <div className="hidden lg:flex w-full lg:w-[420px] flex-col gap-3 shrink-0 h-[600px] lg:h-auto z-10 bg-surface-app">
                <h3 className="text-card-title font-semibold text-text-primary">Recommended neighbourhoods</h3>
                <div className="flex-1 overflow-y-auto">
                  {(!mounted || isDesktop) && (
                    <RecommendationList 
                      data={data} 
                      loading={loading} 
                      error={error} 
                      selectedLocalityId={selectedLocalityId}
                      onSelect={setSelectedLocalityId}
                    />
                  )}
                </div>
              </div>

              {/* Map */}
              <div className="w-full flex-1 lg:rounded-card lg:border border-border-default overflow-hidden lg:shadow-subtle relative z-0 h-full">
                <MapContainer
                  workLat={state.lat}
                  workLng={state.lng}
                  onWorkLocationSelect={handleWorkLocationSelect}
                  recommendations={data?.recommendations || []}
                  selectedLocalityId={selectedLocalityId}
                  onRecommendationSelect={setSelectedLocalityId}
                />
              </div>
              
              {/* MOBILE Recommendation Sheet */}
              <div className="lg:hidden">
                {mounted && !isDesktop && (
                  <MobileRecommendationSheet 
                    data={data} 
                    loading={loading} 
                    error={error}
                    selectedLocalityId={selectedLocalityId}
                    onSelect={setSelectedLocalityId}
                  />
                )}
              </div>

            </div>
          </section>
        )}
      </main>
    </div>
  );
}
