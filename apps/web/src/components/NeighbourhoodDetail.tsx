import React from 'react';
import { RecommendationResult } from '../lib/api';
import { AlertTriangle } from 'lucide-react';

interface NeighbourhoodDetailProps {
  recommendation: RecommendationResult;
}

interface FactorRowProps {
  label: string;
  rawValue: string;
  normalisedScore: number | null;
  isWeighted?: boolean;
}

function FactorRow({ label, rawValue, normalisedScore, isWeighted = false }: FactorRowProps) {
  if (normalisedScore === null) {
    return (
      <div className="flex items-center gap-3 py-1.5 opacity-50">
        <span className="w-24 text-[13px] text-text-muted truncate">{label}</span>
        <span className="w-20 text-[13px] text-text-muted tabular-nums text-right">—</span>
        <div className="flex-1 h-[6px] bg-border-subtle rounded-full" />
        <span className="text-[11px] text-text-muted uppercase">N/A</span>
      </div>
    );
  }

  const pct = Math.round(normalisedScore * 100);
  const barColour = pct >= 80 ? 'bg-success-text' : pct >= 50 ? 'bg-warning-text' : 'bg-error-text';

  return (
    <div className={`flex items-center gap-3 py-1.5 ${isWeighted ? '' : 'opacity-60'}`}>
      <span className={`w-24 text-[13px] truncate ${isWeighted ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
        {label}
      </span>
      <span className="w-20 text-[13px] text-text-secondary tabular-nums text-right">{rawValue}</span>
      <div className="flex-1 h-[6px] bg-border-subtle rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColour}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function NeighbourhoodDetail({ recommendation }: NeighbourhoodDetailProps) {
  const r = recommendation;
  const cs = r.component_scores;
  const rm = r.raw_metrics;

  const scoreColour = 'text-brand-primary';

  const metroLabel = rm.metro_distance_m !== null
    ? rm.metro_distance_m >= 1000
      ? `${(rm.metro_distance_m / 1000).toFixed(1)} km`
      : `${Math.round(rm.metro_distance_m)} m`
    : '—';

  const nearestStation = r.metadata.nearest_metro_station?.name;

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border-subtle shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold text-text-primary tracking-tight leading-tight truncate">
              {r.name}
            </h2>
            {nearestStation && (
              <p className="text-[11px] text-text-muted mt-1">
                Nearest metro: {nearestStation}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end">
            <div className={`text-[28px] font-extrabold tabular-nums leading-none ${scoreColour}`}>
              {Math.round(r.total_score)}
            </div>
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">
              Match Score
            </div>
          </div>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="px-5 pt-3 pb-2">
        <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.08em] mb-1.5">
          WHY IT RANKED #{r.rank}
        </h3>
        <div className="flex flex-col">
          <FactorRow label="Work Proximity" rawValue={`${rm.work_distance_km} km`} normalisedScore={cs.work_distance} isWeighted />
          <FactorRow label="Metro" rawValue={metroLabel} normalisedScore={cs.metro} isWeighted={cs.metro !== null} />
        </div>
      </div>

      <div className="px-5 pt-2 pb-2 border-t border-border-subtle">
        <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.08em] mb-1.5">
          LIFESTYLE AROUND YOU
        </h3>
        <div className="flex flex-col">
          <FactorRow
            label="Cafes"
            rawValue={rm.cafe_accessibility !== null ? `${Math.round(rm.cafe_accessibility)} nearby` : '—'}
            normalisedScore={cs.cafe}
            isWeighted={cs.cafe !== null}
          />
          <FactorRow
            label="Restaurants"
            rawValue={rm.restaurant_accessibility !== null ? `${Math.round(rm.restaurant_accessibility)} nearby` : '—'}
            normalisedScore={cs.restaurant}
            isWeighted={cs.restaurant !== null}
          />
          <FactorRow
            label="Parks"
            rawValue={rm.park_accessibility !== null ? `${Math.round(rm.park_accessibility)} nearby` : '—'}
            normalisedScore={cs.park}
            isWeighted={cs.park !== null}
          />
          <FactorRow
            label="Healthcare"
            rawValue={rm.healthcare_accessibility !== null ? `${Math.round(rm.healthcare_accessibility)} nearby` : '—'}
            normalisedScore={cs.healthcare}
            isWeighted={cs.healthcare !== null}
          />
          <FactorRow
            label="Nightlife"
            rawValue={rm.nightlife_accessibility !== null ? `${Math.round(rm.nightlife_accessibility)} nearby` : '—'}
            normalisedScore={cs.nightlife}
            isWeighted={cs.nightlife !== null}
          />
        </div>
      </div>

      {/* Trade-offs */}
      {r.explanations.warnings.length > 0 && (
        <div className="px-5 pt-2 pb-4 border-t border-border-subtle">
          <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.08em] mb-1.5">
            Trade-offs
          </h3>
          <div className="flex flex-col gap-1.5">
            {r.explanations.warnings.map((warning, i) => (
              <div key={`warn-${i}`} className="flex items-start gap-2">
                <AlertTriangle size={13} className="text-warning-text shrink-0 mt-0.5" />
                <span className="text-[13px] text-text-secondary leading-snug">{warning}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
