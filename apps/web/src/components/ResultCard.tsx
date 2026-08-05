import React from 'react';
import { RecommendationResult } from '../lib/api';
import { Train, MapPin } from 'lucide-react';

interface ResultCardProps {
  result: RecommendationResult;
  selected?: boolean;
  onSelect?: () => void;
}

export function ResultCard({ result, selected = false, onSelect }: ResultCardProps) {
  const isTopMatch = result.rank === 1;
  const isMetroUnavailable = result.component_scores.metro === null;
  
  let scoreColor = 'text-score-weak';
  if (result.total_score >= 80) scoreColor = 'text-score-strong';
  else if (result.total_score >= 50) scoreColor = 'text-score-moderate';

  const borderClass = selected ? 'border-brand-primary shadow-subtle' : 'border-border-default';
  const bgClass = selected ? 'bg-brand-surface' : 'bg-surface-primary';
  const interactiveClass = onSelect ? 'cursor-pointer hover:border-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1' : '';

  return (
    <div 
      id={`rec-card-${result.locality_id}`}
      role={onSelect ? "button" : undefined}
      aria-pressed={onSelect ? selected : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={onSelect ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      } : undefined}
      className={`${bgClass} rounded-card border ${borderClass} overflow-hidden ${interactiveClass}`}
    >
      <div className="p-4 md:p-5 flex items-start gap-4">
        
        {/* Rank */}
        <div className="flex flex-col items-center min-w-[3rem]">
          <span className="text-label font-bold text-text-muted uppercase tracking-wider mb-1">
            Rank
          </span>
          <div className={`text-heading font-black ${isTopMatch ? 'text-brand-primary' : 'text-text-primary'}`}>
            #{result.rank}
          </div>
        </div>
        
        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-card-title font-bold text-text-primary truncate">
              {result.name}
            </h3>
            {isTopMatch && (
              <span className="bg-brand-surface text-brand-primary text-metadata font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide border border-border-default whitespace-nowrap">
                Best Match
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-label text-text-secondary">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <MapPin size={14} className="text-text-muted" /> 
              {result.raw_metrics.work_distance_km} km
            </span>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <Train size={14} className="text-text-muted" /> 
              {isMetroUnavailable ? 'Unavailable' : `${result.raw_metrics.metro_distance_m}m`}
            </span>
          </div>
        </div>

        {/* Score */}
        <div className="text-right pl-4 border-l border-border-subtle flex flex-col items-end">
          <div className={`text-2xl md:text-3xl font-black ${scoreColor} leading-none`}>
            {result.total_score}
          </div>
          <div className="text-metadata font-bold text-text-muted uppercase tracking-wider mt-1">
            Fit
          </div>
        </div>
      </div>

      {(result.explanations.pros.length > 0 || result.explanations.warnings.length > 0) && (
        <div className="px-4 md:px-5 py-3 bg-surface-secondary border-t border-border-default space-y-1.5">
          {result.explanations.pros.slice(0, 2).map((pro, i) => (
            <div key={`pro-${i}`} className="flex items-start gap-2">
              <span className="text-success-text shrink-0 font-bold text-[10px] mt-[3px]">✓</span>
              <span className="text-label text-text-primary leading-tight">{pro}</span>
            </div>
          ))}
          {result.explanations.warnings.slice(0, 1).map((warning, i) => (
            <div key={`warn-${i}`} className="flex items-start gap-2">
              <span className="text-text-muted shrink-0 font-bold text-[12px] mt-px">–</span>
              <span className="text-label text-text-secondary leading-tight">{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
