import React, { useState } from 'react';
import { RecommendationList } from './RecommendationList';
import { RecommendationResponse } from '../lib/api';

interface MobileRecommendationSheetProps {
  data: RecommendationResponse | null;
  loading: boolean;
  error: string | null;
  isValidating?: boolean;
  isColdStarting?: boolean;
  selectedLocalityId?: number | null;
  onSelect?: (id: number) => void;
  onHover?: (id: number | null) => void;
  onRetry?: () => void;
}

export function MobileRecommendationSheet({ data, loading, error, isValidating, isColdStarting, selectedLocalityId, onSelect, onHover, onRetry }: MobileRecommendationSheetProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div 
      className={`absolute bottom-0 left-0 right-0 bg-surface-primary rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col z-40 ${
        expanded ? 'h-[85dvh]' : 'h-[35dvh]'
      }`}
    >
      <button 
        className="w-full pt-4 pb-3 flex justify-center items-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 rounded-t-3xl"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="mobile-sheet-content"
        aria-label={expanded ? "Collapse recommendations" : "Expand recommendations"}
      >
        <div className="w-12 h-1.5 bg-border-default hover:bg-text-muted transition-colors rounded-full" />
      </button>
      
      <div className="px-5 pb-3 shrink-0 flex justify-between items-center border-b border-border-default/50">
        <div className="flex items-center gap-3">
          <h3 className="text-card-title font-semibold text-text-primary">Recommended</h3>
          {isValidating && (
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5 bg-surface-secondary px-2 py-0.5 rounded-sm border border-border-default">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></span>
              Updating
            </span>
          )}
        </div>
        <span className="text-label text-brand-primary font-bold bg-brand-primary/10 px-2 py-0.5 rounded-full">
          {data?.recommendations?.length || 0} results
        </span>
      </div>

      <div id="mobile-sheet-content" className="flex-1 overflow-y-auto px-4 pt-4 pb-safe">
        <RecommendationList 
          data={data} 
          loading={loading} 
          error={error} 
          isColdStarting={isColdStarting}
          selectedLocalityId={selectedLocalityId}
          onSelect={onSelect}
          onHover={onHover}
          onRetry={onRetry}
        />
      </div>
    </div>
  );
}
