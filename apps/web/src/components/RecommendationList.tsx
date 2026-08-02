import React from 'react';
import { ResultCard } from './ResultCard';
import { RecommendationResponse } from '../lib/api';

interface RecommendationListProps {
  data: RecommendationResponse | null;
  loading: boolean;
  error: string | null;
}

export function RecommendationList({ data, loading, error }: RecommendationListProps) {
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
        <p className="text-sm font-semibold text-red-900">Error fetching recommendations</p>
        <p className="text-xs text-red-700 mt-1">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-32 flex flex-col justify-between">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-100 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  if (data.recommendations.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl text-center py-8">
        <p className="text-sm font-semibold text-gray-900">No localities found</p>
        <p className="text-xs text-gray-500 mt-1">Try increasing your maximum commute distance.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.recommendations.map((rec) => (
        <ResultCard key={rec.locality_id} result={rec} />
      ))}
      <div className="mt-4 p-3 bg-blue-50/50 rounded-lg text-xs text-blue-600 text-center border border-blue-100/50">
        Results powered by blr.life deterministic engine.<br/>
        <span className="opacity-75">v: {data.provenance.calc_versions_used.join(', ')}</span>
      </div>
    </div>
  );
}
