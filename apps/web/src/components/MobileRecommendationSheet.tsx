import React, { useState, useEffect } from "react";
import { RecommendationList } from "./RecommendationList";
import { NeighbourhoodDetail } from "./NeighbourhoodDetail";
import { RecommendationResponse } from "../lib/api";
import { ArrowLeft } from "lucide-react";

interface MobileRecommendationSheetProps {
  data: RecommendationResponse | null;
  displayRecommendations?: RecommendationResult[];
  activeView?: "all" | "saved";
  loading: boolean;
  error: string | null;
  isValidating?: boolean;
  isColdStarting?: boolean;
  selectedLocalityId?: number | null;
  savedLocalityIds?: number[];
  maxWorkDistance?: number;
  onSelect?: (id: number) => void;
  onHover?: (id: number | null) => void;
  onRetry?: () => void;
  onToggleSave?: (id: number) => void;
  onToggleView?: () => void;
  compareLocalityIds?: number[];
  onToggleCompare?: (id: number) => void;
}

import { RecommendationResult } from "../lib/api";

export function MobileRecommendationSheet({
  data,
  displayRecommendations,
  activeView = "all",
  loading,
  error,
  isValidating,
  isColdStarting,
  selectedLocalityId,
  savedLocalityIds = [],
  maxWorkDistance,
  onSelect,
  onHover,
  onRetry,
  onToggleSave,
  onToggleView,
  compareLocalityIds = [],
  onToggleCompare,
}: MobileRecommendationSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");

  const handleSelect = (id: number) => {
    if (onSelect) onSelect(id);
    setView("detail");
    setExpanded(true); // Expand sheet when viewing details
  };

  const handleBack = () => {
    setView("list");
  };

  const selectedRecommendation =
    displayRecommendations?.find((r) => r.locality_id === selectedLocalityId) ??
    null;
  const showDetail = view === "detail" && selectedRecommendation;

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-surface-primary rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col z-40 ${
        expanded ? "h-[85dvh]" : "h-[35dvh]"
      }`}
    >
      <button
        className="w-full pt-4 pb-3 flex justify-center items-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 rounded-t-3xl"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="mobile-sheet-content"
        aria-label={
          expanded ? "Collapse recommendations" : "Expand recommendations"
        }
      >
        <div className="w-12 h-1.5 bg-border-default hover:bg-text-muted transition-colors rounded-full" />
      </button>

      {!showDetail ? (
        <>
          <div className="px-5 pb-3 shrink-0 flex justify-between items-center border-b border-border-default/50">
            <div className="flex items-center gap-3">
              <div className="flex bg-surface-secondary p-0.5 rounded-lg border border-border-default">
                <button
                  onClick={() => {
                    if (activeView !== "all" && onToggleView) onToggleView();
                  }}
                  className={`text-[12px] px-3 py-1 font-bold rounded-md transition-colors ${
                    activeView === "all"
                      ? "bg-surface-primary text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  All Results
                </button>
                <button
                  onClick={() => {
                    if (activeView !== "saved" && onToggleView) onToggleView();
                  }}
                  className={`text-[12px] px-3 py-1 font-bold rounded-md transition-colors flex items-center gap-1.5 ${
                    activeView === "saved"
                      ? "bg-surface-primary text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Saved
                  {savedLocalityIds.length > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                        activeView === "saved"
                          ? "bg-brand-primary/10 text-brand-primary"
                          : "bg-surface-app text-text-muted"
                      }`}
                    >
                      {savedLocalityIds.length}
                    </span>
                  )}
                </button>
              </div>
              {isValidating && (
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5 bg-surface-secondary px-2 py-0.5 rounded-sm border border-border-default">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></span>
                  Updating
                </span>
              )}
            </div>
            <span className="text-label text-brand-primary font-bold bg-brand-primary/10 px-2 py-0.5 rounded-full">
              {displayRecommendations?.length || 0} results
            </span>
          </div>

          <div
            id="mobile-sheet-content"
            className="flex-1 overflow-y-auto px-4 pt-4 pb-safe"
          >
            <RecommendationList
              data={data}
              displayRecommendations={displayRecommendations}
              activeView={activeView}
              loading={loading}
              error={error}
              isColdStarting={isColdStarting}
              selectedLocalityId={selectedLocalityId}
              savedLocalityIds={savedLocalityIds}
              maxWorkDistance={maxWorkDistance}
              onSelect={handleSelect}
              onHover={onHover}
              onRetry={onRetry}
              onToggleSave={onToggleSave}
              compareLocalityIds={compareLocalityIds}
              onToggleCompare={onToggleCompare}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-3 pb-2 shrink-0 border-b border-border-default/50">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 py-1.5 px-3 rounded-full hover:bg-surface-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 text-text-secondary hover:text-text-primary font-medium text-[13px]"
              aria-label="Back to recommendations"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          </div>
          <div
            id="mobile-sheet-content"
            className="flex-1 overflow-y-auto pb-safe"
          >
            <NeighbourhoodDetail
              recommendation={selectedRecommendation}
              isSaved={savedLocalityIds.includes(
                selectedRecommendation.locality_id,
              )}
              maxWorkDistance={maxWorkDistance}
              onToggleSave={onToggleSave}
              isCompared={compareLocalityIds.includes(
                selectedRecommendation.locality_id,
              )}
              onToggleCompare={onToggleCompare}
            />
          </div>
        </div>
      )}
    </div>
  );
}
