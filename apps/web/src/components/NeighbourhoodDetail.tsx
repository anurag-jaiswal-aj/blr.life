import React, { useState, useRef, useEffect } from "react";
import { RecommendationResult } from "../lib/api";
import { AlertTriangle, Info, X, Heart, CheckCircle2 } from "lucide-react";

interface NeighbourhoodDetailProps {
  recommendation: RecommendationResult;
  isSaved?: boolean;
  maxWorkDistance?: number;
  onToggleSave?: (id: number) => void;
}

interface FactorRowProps {
  label: string;
  rawValue: string;
  normalisedScore: number | null;
  isWeighted?: boolean;
}

function FactorRow({
  label,
  rawValue,
  normalisedScore,
  isWeighted = false,
}: FactorRowProps) {
  if (normalisedScore === null) {
    return (
      <div className="flex items-center gap-3 py-1.5 opacity-50">
        <span className="w-24 text-[13px] text-text-muted truncate">
          {label}
        </span>
        <span className="w-20 text-[13px] text-text-muted tabular-nums text-right">
          —
        </span>
        <div className="flex-1 h-[6px] bg-border-subtle rounded-full" />
        <span className="text-[11px] text-text-muted uppercase">N/A</span>
      </div>
    );
  }

  const pct = Math.round(normalisedScore * 100);
  const barColour =
    pct >= 80
      ? "bg-success-text"
      : pct >= 50
        ? "bg-warning-text"
        : "bg-error-text";

  return (
    <div
      className={`flex items-center gap-3 py-1.5 ${isWeighted ? "" : "opacity-60"}`}
    >
      <span
        className={`w-24 text-[13px] truncate ${isWeighted ? "text-text-primary font-medium" : "text-text-secondary"}`}
      >
        {label}
      </span>
      <span className="w-20 text-[13px] text-text-secondary tabular-nums text-right">
        {rawValue}
      </span>
      <div className="flex-1 h-[6px] bg-border-subtle rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColour}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function NeighbourhoodDetail({
  recommendation,
  isSaved = false,
  maxWorkDistance,
  onToggleSave,
}: NeighbourhoodDetailProps) {
  const r = recommendation;
  const cs = r.component_scores;
  const rm = r.raw_metrics;

  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const explanationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExplanationOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExplanationOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExplanationOpen]);

  useEffect(() => {
    if (!isExplanationOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        explanationRef.current &&
        !explanationRef.current.contains(e.target as Node)
      ) {
        setIsExplanationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isExplanationOpen]);

  const scoreColour = "text-brand-primary";

  const metroLabel =
    rm.metro_distance_m !== null
      ? rm.metro_distance_m >= 1000
        ? `${(rm.metro_distance_m / 1000).toFixed(1)} km`
        : `${Math.round(rm.metro_distance_m)} m`
      : "—";

  const nearestStation = r.metadata.nearest_metro_station?.name;
  const nearestStationLine = r.metadata.nearest_metro_station?.line;

  const getLineColor = (line?: string) => {
    switch (line?.toLowerCase()) {
      case "purple":
        return "bg-purple-500";
      case "green":
        return "bg-green-500";
      case "yellow":
        return "bg-yellow-500";
      case "pink":
        return "bg-pink-500";
      case "blue":
        return "bg-blue-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border-subtle shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-bold text-text-primary tracking-tight leading-tight truncate">
                {r.name}
              </h2>
              {onToggleSave && (
                <button
                  type="button"
                  onClick={() => onToggleSave(r.locality_id)}
                  aria-pressed={isSaved}
                  aria-label={
                    isSaved
                      ? `Remove ${r.name} from shortlist`
                      : `Save ${r.name} to shortlist`
                  }
                  className={`p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary shrink-0 ${
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
            {nearestStation && (
              <p className="text-[11px] text-text-muted mt-1 flex items-center gap-1.5">
                Nearest metro:{" "}
                <span
                  className={`w-2 h-2 rounded-full ${getLineColor(nearestStationLine)}`}
                />{" "}
                {nearestStation}
              </p>
            )}
            {isSaved &&
              maxWorkDistance !== undefined &&
              rm.work_distance_km > maxWorkDistance && (
                <div className="mt-2">
                  <span className="inline-flex items-center text-[11px] font-medium text-warning-text bg-warning-bg px-2 py-0.5 rounded-sm border border-warning-text/20">
                    ⚠ Beyond your selected distance
                  </span>
                </div>
              )}
          </div>
          <div className="text-right shrink-0 flex flex-col items-end relative">
            <div
              className={`text-[28px] font-extrabold tabular-nums leading-none ${scoreColour}`}
            >
              {Math.round(r.total_score)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Match Score
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExplanationOpen(!isExplanationOpen);
                }}
                aria-label="Explain Match Score"
                aria-expanded={isExplanationOpen}
                className="text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded"
              >
                <Info size={13} />
              </button>
            </div>
            {isExplanationOpen && (
              <div
                ref={explanationRef}
                role="dialog"
                aria-label="Match Score Explanation"
                className="absolute top-full right-0 mt-2 p-3 bg-surface-primary border border-border-default shadow-elevated rounded-lg z-50 w-[200px] text-left"
              >
                <div className="flex justify-between items-start mb-2 border-b border-border-subtle pb-2">
                  <h4 className="text-[12px] font-bold text-text-primary leading-snug">
                    How this score is calculated
                  </h4>
                  <button
                    onClick={() => setIsExplanationOpen(false)}
                    aria-label="Close explanation"
                    className="text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded"
                  >
                    <X size={14} />
                  </button>
                </div>
                <ul className="text-[12px] text-text-secondary space-y-1.5 tabular-nums">
                  {r.score_contributions.work_distance !== null && (
                    <li className="flex justify-between">
                      <span>Work Proximity:</span>{" "}
                      <span>+{r.score_contributions.work_distance} pts</span>
                    </li>
                  )}
                  {r.score_contributions.metro !== null && (
                    <li className="flex justify-between">
                      <span>Metro Access:</span>{" "}
                      <span>+{r.score_contributions.metro} pts</span>
                    </li>
                  )}
                  {r.score_contributions.cafe !== null && (
                    <li className="flex justify-between">
                      <span>Cafes:</span>{" "}
                      <span>+{r.score_contributions.cafe} pts</span>
                    </li>
                  )}
                  {r.score_contributions.restaurant !== null && (
                    <li className="flex justify-between">
                      <span>Restaurants:</span>{" "}
                      <span>+{r.score_contributions.restaurant} pts</span>
                    </li>
                  )}
                  {r.score_contributions.park !== null && (
                    <li className="flex justify-between">
                      <span>Parks:</span>{" "}
                      <span>+{r.score_contributions.park} pts</span>
                    </li>
                  )}
                  {r.score_contributions.healthcare !== null && (
                    <li className="flex justify-between">
                      <span>Healthcare:</span>{" "}
                      <span>+{r.score_contributions.healthcare} pts</span>
                    </li>
                  )}
                  {r.score_contributions.nightlife !== null && (
                    <li className="flex justify-between">
                      <span>Nightlife:</span>{" "}
                      <span>+{r.score_contributions.nightlife} pts</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="px-5 pt-3 pb-2">
        <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.08em] mb-1.5">
          WHY IT RANKED #{r.rank}
        </h3>
        <div className="flex flex-col">
          <FactorRow
            label="Work Proximity"
            rawValue={`${rm.work_distance_km} km`}
            normalisedScore={cs.work_distance}
            isWeighted
          />
          <FactorRow
            label="Metro"
            rawValue={metroLabel}
            normalisedScore={cs.metro}
            isWeighted={cs.metro !== null}
          />
        </div>
      </div>

      <div className="px-5 pt-2 pb-2 border-t border-border-subtle">
        <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.08em] mb-1.5">
          LIFESTYLE AROUND YOU
        </h3>
        <div className="flex flex-col">
          <FactorRow
            label="Cafes"
            rawValue={
              rm.cafe_accessibility !== null
                ? `${Math.round(rm.cafe_accessibility)} nearby`
                : "—"
            }
            normalisedScore={cs.cafe}
            isWeighted={cs.cafe !== null}
          />
          <FactorRow
            label="Restaurants"
            rawValue={
              rm.restaurant_accessibility !== null
                ? `${Math.round(rm.restaurant_accessibility)} nearby`
                : "—"
            }
            normalisedScore={cs.restaurant}
            isWeighted={cs.restaurant !== null}
          />
          <FactorRow
            label="Parks"
            rawValue={
              rm.park_accessibility !== null
                ? `${Math.round(rm.park_accessibility)} nearby`
                : "—"
            }
            normalisedScore={cs.park}
            isWeighted={cs.park !== null}
          />
          <FactorRow
            label="Healthcare"
            rawValue={
              rm.healthcare_accessibility !== null
                ? `${Math.round(rm.healthcare_accessibility)} nearby`
                : "—"
            }
            normalisedScore={cs.healthcare}
            isWeighted={cs.healthcare !== null}
          />
          <FactorRow
            label="Nightlife"
            rawValue={
              rm.nightlife_accessibility !== null
                ? `${Math.round(rm.nightlife_accessibility)} nearby`
                : "—"
            }
            normalisedScore={cs.nightlife}
            isWeighted={cs.nightlife !== null}
          />
        </div>
      </div>
      {/* Pros */}
      {r.explanations.pros.length > 0 && (
        <div className="px-5 pt-2 pb-2 border-t border-border-subtle">
          <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.08em] mb-1.5">
            Pros
          </h3>
          <div className="flex flex-col gap-1.5">
            {r.explanations.pros.map((pro, i) => (
              <div key={`pro-${i}`} className="flex items-start gap-2">
                <CheckCircle2
                  size={13}
                  className="text-success-text shrink-0 mt-0.5"
                />
                <span className="text-[13px] text-text-secondary leading-snug">
                  {pro}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade-offs */}
      {r.explanations.warnings.length > 0 && (
        <div className="px-5 pt-2 pb-4 border-t border-border-subtle">
          <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.08em] mb-1.5">
            Trade-offs
          </h3>
          <div className="flex flex-col gap-1.5">
            {r.explanations.warnings.map((warning, i) => (
              <div key={`warn-${i}`} className="flex items-start gap-2">
                <AlertTriangle
                  size={13}
                  className="text-warning-text shrink-0 mt-0.5"
                />
                <span className="text-[13px] text-text-secondary leading-snug">
                  {warning}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
