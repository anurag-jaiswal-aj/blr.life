import React from 'react';
import { RecommendationResult } from '../lib/api';
import { Train, MapPin } from 'lucide-react';

interface ResultCardProps {
  result: RecommendationResult;
  selected?: boolean;
  onSelect?: (id: number) => void;
  onHover?: (id: number | null) => void;
}

export function ResultCard({ result, selected = false, onSelect, onHover }: ResultCardProps) {
  const isMetroUnavailable = result.component_scores.metro === null;
  
  const bgClass = selected ? 'bg-surface-secondary border-border-strong' : 'bg-surface-primary border-border-subtle';
  const leftBorder = selected ? 'border-l-[3px] border-l-brand-primary' : 'border-l-[3px] border-l-transparent';
  const interactiveClass = onSelect ? 'cursor-pointer hover:bg-surface-secondary transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-brand-primary' : '';

  const metroText = isMetroUnavailable
    ? '—'
    : result.raw_metrics.metro_distance_m !== null && result.raw_metrics.metro_distance_m >= 1000
      ? `${(result.raw_metrics.metro_distance_m / 1000).toFixed(1)} km`
      : `${Math.round(result.raw_metrics.metro_distance_m || 0)} m`;

  return (
    <div 
      id={`rec-card-${result.locality_id}`}
      role={onSelect ? "button" : undefined}
      aria-pressed={onSelect ? selected : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? () => onSelect(result.locality_id) : undefined}
      onMouseEnter={onHover ? () => onHover(result.locality_id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onKeyDown={onSelect ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(result.locality_id);
        }
      } : undefined}
      className={`${bgClass} ${leftBorder} ${interactiveClass}`}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        
        {/* Rank */}
        <div className="text-[20px] font-bold tracking-tighter tabular-nums text-text-muted leading-none pt-0.5">
          {String(result.rank).padStart(2, '0')}
        </div>
        
        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-text-primary truncate tracking-tight">
              {result.name}
            </h3>
          </div>
          
          <div className="flex items-center gap-2 mt-1 text-[13px] text-text-secondary">
            <span className="flex items-center whitespace-nowrap tabular-nums">
              {result.raw_metrics.work_distance_km} km commute
            </span>
            <span className="text-border-strong">•</span>
            <span className="flex items-center whitespace-nowrap tabular-nums">
              {metroText} metro
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
