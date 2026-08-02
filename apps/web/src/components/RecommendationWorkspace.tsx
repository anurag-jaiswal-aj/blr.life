'use client';

import React from 'react';
import { useUrlState } from '../hooks/useUrlState';
import { useRecommendations } from '../hooks/useRecommendations';
import { MapContainer } from '../components/MapContainer';
import { ControlsPanel } from '../components/ControlsPanel';
import { RecommendationList } from '../components/RecommendationList';

export function RecommendationWorkspace() {
  const { state, updateState, getApiRequest } = useUrlState();
  const request = getApiRequest();
  const { data, loading, error } = useRecommendations(request);

  const handleWorkLocationSelect = (lat: number, lng: number) => {
    updateState({ lat, lng });
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-gray-50 overflow-hidden">
      {/* Sidebar Controls and Results */}
      <div className="w-full md:w-[400px] lg:w-[450px] h-[50vh] md:h-screen flex flex-col shadow-2xl z-10 bg-gray-50">
        <div className="p-4 shrink-0 z-20 sticky top-0 bg-gray-50/90 backdrop-blur pb-2">
          <ControlsPanel state={state} updateState={updateState} />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 pt-2">
          <RecommendationList data={data} loading={loading} error={error} />
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 h-[50vh] md:h-screen relative">
        <MapContainer
          workLat={state.lat}
          workLng={state.lng}
          onWorkLocationSelect={handleWorkLocationSelect}
          recommendations={data?.recommendations || []}
        />
      </div>
    </div>
  );
}
