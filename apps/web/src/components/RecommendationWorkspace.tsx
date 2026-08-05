'use client';

import React from 'react';
import { useUrlState } from '../hooks/useUrlState';
import { useRecommendations } from '../hooks/useRecommendations';
import { MapContainer } from '../components/MapContainer';
import { ControlsPanel } from '../components/ControlsPanel';
import { RecommendationList } from '../components/RecommendationList';
import { WorkLocationInput } from '../components/WorkLocationInput';

export function RecommendationWorkspace() {
  const { state, updateState, getApiRequest } = useUrlState();
  const request = getApiRequest();
  const { data, loading, error } = useRecommendations(request);

  const handleWorkLocationSelect = (lat: number, lng: number) => {
    updateState({ lat, lng });
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-app text-text-primary font-sans">
      {/* HEADER */}
      <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-surface-primary border-b border-border-default sticky top-0 z-50">
        <div className="text-wordmark font-bold text-brand-primary tracking-tight">blr.life</div>
        <div className="text-label font-medium text-text-muted uppercase tracking-widest hidden sm:block">Bengaluru neighbourhoods</div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col w-full mx-auto pb-12">
        
        {/* PRODUCT INTRO & PRIMARY TASK */}
        <section className="px-4 md:px-8 py-8 md:py-12 max-w-4xl w-full">
          <h1 className="text-heading md:text-3xl font-bold text-brand-primary tracking-tight mb-2">
            Find the Bengaluru neighbourhood that fits your life.
          </h1>
          <p className="text-body text-text-secondary mb-8 max-w-2xl">
            Start with where you work. We&apos;ll help narrow where to live.
          </p>
          
          <div className="max-w-xl">
            <WorkLocationInput state={state} updateState={updateState} />
          </div>
        </section>

        {/* WORKSPACE (Controls, Results, Map) */}
        {state.lat !== null && state.lng !== null && (
          <section className="flex-1 px-4 md:px-8 flex flex-col gap-6 w-full">
            
            {/* CONTROLS AREA */}
            <div className="w-full">
              <h2 className="text-card-title font-semibold text-text-primary mb-3">Refine recommendations</h2>
              <ControlsPanel state={state} updateState={updateState} />
            </div>

            {/* RESULTS & MAP AREA */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[600px] mt-2">
              
              {/* Recommendation List */}
              <div className="w-full lg:w-[420px] flex flex-col gap-3">
                <h3 className="text-card-title font-semibold text-text-primary">Recommended neighbourhoods</h3>
                <div className="flex-1 overflow-y-auto">
                  <RecommendationList data={data} loading={loading} error={error} />
                </div>
              </div>

              {/* Map */}
              <div className="w-full shrink-0 h-[60vh] lg:h-auto lg:flex-1 rounded-card border border-border-default overflow-hidden shadow-subtle relative">
                <MapContainer
                  workLat={state.lat}
                  workLng={state.lng}
                  onWorkLocationSelect={handleWorkLocationSelect}
                  recommendations={data?.recommendations || []}
                />
              </div>

            </div>
          </section>
        )}
      </main>
    </div>
  );
}
