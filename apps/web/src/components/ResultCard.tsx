import React from "react";
import { RecommendationResult } from "../lib/api";
import { Heart, Scale } from "lucide-react";

interface ResultCardProps {
  result: RecommendationResult;
  selected?: boolean;
  isSaved?: boolean;
  maxWorkDistance?: number;
  onSelect?: (id: number) => void;
  onHover?: (id: number | null) => void;
  onToggleSave?: (id: number) => void;
  isCompared?: boolean;
  onToggleCompare?: (id: number) => void;
}

export function ResultCard({
  result,
  selected = false,
  isSaved = false,
  maxWorkDistance,
  onSelect,
  onHover,
  onToggleSave,
  isCompared = false,
  onToggleCompare,
}: ResultCardProps) {
  const isMetroUnavailable = result.component_scores.metro === null;

  const bgClass = selected
    ? "bg-surface-secondary border-border-strong"
    : "bg-surface-primary border-border-subtle";
  const leftBorder = selected
    ? "border-l-[3px] border-l-brand-primary"
    : "border-l-[3px] border-l-transparent";
  const interactiveClass = onSelect
    ? "cursor-pointer hover:bg-surface-secondary transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-brand-primary"
    : "";

  const metroText = isMetroUnavailable
    ? "—"
    : result.raw_metrics.metro_distance_m !== null &&
        result.raw_metrics.metro_distance_m >= 1000
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
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(result.locality_id);
              }
            }
          : undefined
      }
      className={`${bgClass} ${leftBorder} ${interactiveClass}`}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Rank */}
        <div className="text-[20px] font-bold tracking-tighter tabular-nums text-text-muted leading-none pt-0.5">
          {String(result.rank).padStart(2, "0")}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-bold text-text-primary truncate tracking-tight flex-1">
              {result.name}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              {onToggleCompare && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCompare(result.locality_id);
                  }}
                  aria-pressed={isCompared}
                  aria-label={
                    isCompared
                      ? `Remove ${result.name} from comparison`
                      : `Add ${result.name} to comparison`
                  }
                  className={`p-1.5 -mr-1 -mt-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    isCompared
                      ? "text-brand-primary bg-brand-primary/10"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  <Scale className="w-[18px] h-[18px]" />
                </button>
              )}
              {onToggleSave && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSave(result.locality_id);
                  }}
                  aria-pressed={isSaved}
                  aria-label={
                    isSaved
                      ? `Remove ${result.name} from shortlist`
                      : `Save ${result.name} to shortlist`
                  }
                  className={`p-1.5 -mr-1.5 -mt-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    isSaved
                      ? "text-brand-primary"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  <Heart
                    className="w-[18px] h-[18px]"
                    fill={isSaved ? "currentColor" : "none"}
                    strokeWidth={isSaved ? 0 : 2}
                  />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[13px] text-text-secondary">
            <span className="flex items-center whitespace-nowrap tabular-nums">
              {result.raw_metrics.work_distance_km} km away
            </span>
            <span className="text-border-strong">•</span>
            <span className="flex items-center whitespace-nowrap tabular-nums">
              {metroText} metro
            </span>
          </div>

          {result.affordability && (
            <div className="mt-2 pt-2 border-t border-border-subtle flex flex-wrap gap-2 items-center">
              {result.affordability.status === "affordable" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-success-bg text-success-text border border-success-text/20">
                  ✓ Within budget
                </span>
              )}
              {result.affordability.status === "starts_within_budget" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-warning-bg text-warning-text border border-warning-text/20">
                  ⚠ Starts within budget
                </span>
              )}
              {result.affordability.status === "over_budget" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-error-bg text-error-text border border-error-text/20">
                  ✗ Over budget
                </span>
              )}
              {result.affordability.status === "unknown" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-secondary text-text-muted border border-border-default">
                  ○ Rent unavailable
                </span>
              )}

              {result.affordability.status !== "unknown" &&
                result.affordability.rent_min_inr !== null && (
                  <span className="text-[12px] text-text-secondary font-medium flex items-center gap-1">
                    ₹{result.affordability.rent_min_inr.toLocaleString()}–₹
                    {result.affordability.rent_max_inr?.toLocaleString()}
                    {result.affordability.confidence === "low" && (
                      <span className="text-[10px] uppercase tracking-wider text-text-muted">
                        (Est.)
                      </span>
                    )}
                  </span>
                )}
              {result.affordability.status === "unknown" && (
                <span className="text-[12px] text-text-muted">
                  We only show verified rent data.
                </span>
              )}
            </div>
          )}

          {isSaved &&
            maxWorkDistance !== undefined &&
            result.raw_metrics.work_distance_km > maxWorkDistance && (
              <div className="mt-2 pt-2 border-t border-border-subtle">
                <span className="inline-flex items-center text-[11px] font-medium text-warning-text bg-warning-bg px-2 py-0.5 rounded-sm border border-warning-text/20">
                  ⚠ Beyond your selected distance
                </span>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
