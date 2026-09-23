import React from "react";
import { X, Scale } from "lucide-react";

interface ComparisonActionBarProps {
  compareCount: number;
  onClear: () => void;
  onCompare: () => void;
}

export function ComparisonActionBar({
  compareCount,
  onClear,
  onCompare,
}: ComparisonActionBarProps) {
  if (compareCount === 0) return null;

  const isReady = compareCount >= 2;

  return (
    <div
      role="region"
      aria-label="Comparison Actions"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center bg-surface-primary border border-border-strong shadow-[0_8px_30px_rgba(0,0,0,0.16)] rounded-full px-4 py-2 gap-4 transition-all animate-in slide-in-from-bottom-8 fade-in duration-300"
    >
      <div className="flex flex-col">
        <span className="text-[14px] font-bold text-text-primary tabular-nums">
          {compareCount} selected
        </span>
        {!isReady && (
          <span className="text-[11px] text-text-muted">
            Add 1 more to compare
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 border-l border-border-default pl-4">
        <button
          onClick={onClear}
          aria-label="Clear comparison selection"
          className="p-2 text-text-muted hover:text-text-primary rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={onCompare}
          disabled={!isReady}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
            isReady
              ? "bg-brand-primary text-white hover:bg-brand-primary/90"
              : "bg-surface-secondary text-text-muted cursor-not-allowed"
          }`}
        >
          <Scale className="w-4 h-4" />
          Compare
        </button>
      </div>
    </div>
  );
}
