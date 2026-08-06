import React, { useEffect } from 'react';
import { ResultCard } from './ResultCard';
import { RecommendationResponse } from '../lib/api';

interface RecommendationListProps {
  data: RecommendationResponse | null;
  loading: boolean;
  error: string | null;
  isColdStarting?: boolean;
  selectedLocalityId?: number | null;
  onSelect?: (id: number) => void;
  onHover?: (id: number | null) => void;
  onRetry?: () => void;
}

export function RecommendationList({ data, loading, error, isColdStarting, selectedLocalityId, onSelect, onHover, onRetry }: RecommendationListProps) {
  useEffect(() => {
    if (selectedLocalityId !== null && selectedLocalityId !== undefined) {
      const el = document.getElementById(`rec-card-${selectedLocalityId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedLocalityId]);

  if (error) {
    return (
      <div className="p-6 bg-error-bg flex flex-col items-start gap-3">
        <div>
          <p className="text-sm font-bold text-error-text">Error fetching recommendations</p>
          <p className="text-xs text-error-text mt-1 opacity-90">{error}</p>
        </div>
        {onRetry && (
          <button 
            onClick={onRetry}
            className="px-4 py-1.5 bg-surface-primary border border-border-strong rounded-md text-xs font-bold text-text-primary hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col divide-y divide-border-subtle">
        {isColdStarting && (
          <div className="p-4 bg-brand-light/30 text-center animate-pulse-slow">
            <p className="text-sm font-medium text-brand-primary">Starting the recommendation service &mdash; this can take a little longer after inactivity.</p>
          </div>
        )}
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-surface-primary p-4 md:p-5 flex flex-col justify-between">
            <div className="flex gap-4 mb-4">
              <div className="w-12 h-12 bg-surface-secondary rounded-lg"></div>
              <div className="space-y-3 flex-1 pt-1">
                <div className="h-4 bg-surface-secondary rounded w-1/2"></div>
                <div className="h-3 bg-surface-secondary rounded w-1/3"></div>
              </div>
            </div>
            <div className="space-y-2 border-t border-border-subtle pt-3">
              <div className="h-3 bg-border-subtle rounded w-3/4"></div>
              <div className="h-3 bg-border-subtle rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  if (data.recommendations.length === 0) {
    return (
      <div className="p-6 bg-surface-primary text-center py-10">
        <p className="text-sm font-bold text-text-primary">No localities found</p>
        <p className="text-xs text-text-secondary mt-1">Adjust your workplace or commute distance.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border-subtle">
      {data.recommendations.map((rec) => (
        <ResultCard 
          key={rec.locality_id} 
          result={rec} 
          selected={selectedLocalityId === rec.locality_id}
          onSelect={onSelect || (() => {})}
          onHover={onHover}
        />
      ))}
      <div className="p-4 bg-surface-secondary text-[11px] text-text-secondary text-center uppercase tracking-wider font-bold">
        Results powered by blr.life deterministic engine.<br/>
        <span className="opacity-75">v: {data.provenance.calc_versions_used.join(', ')}</span>
      </div>
    </div>
  );
}
