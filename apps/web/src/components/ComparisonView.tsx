import React, { useEffect } from "react";
import { RecommendationResult } from "../lib/api";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

interface ComparisonViewProps {
  localities: RecommendationResult[];
  onClose: () => void;
}

export function ComparisonView({ localities, onClose }: ComparisonViewProps) {
  // Lock body scroll when on mobile to prevent double-scrolling
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (localities.length === 0) return null;

  const renderDistance = (meters: number | null) => {
    if (meters === null) return "—";
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };

  const renderAmenity = (val: number | null) => {
    return val !== null ? `${Math.round(val)} nearby` : "—";
  };

  const renderRent = (affordability: RecommendationResult["affordability"]) => {
    if (!affordability || affordability.status === "unknown" || affordability.rent_min_inr === null) {
      return "Unavailable";
    }
    const min = affordability.rent_min_inr.toLocaleString();
    const max = affordability.rent_max_inr?.toLocaleString() ?? "";
    const est = affordability.confidence === "low" ? " (Est.)" : "";
    return `₹${min}–₹${max}${est}`;
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-surface-app z-30 animate-in fade-in slide-in-from-bottom-4 lg:slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-default bg-surface-primary shrink-0">
        <h2 className="text-[18px] font-bold text-text-primary">
          Compare Localities
        </h2>
        <button
          onClick={onClose}
          aria-label="Close comparison"
          className="p-2 -mr-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <X size={20} />
        </button>
      </div>

      {/* Comparison Table Container */}
      <div className="flex-1 overflow-auto p-4 md:p-6 bg-surface-secondary">
        <div className="bg-surface-primary rounded-xl border border-border-default shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <caption className="sr-only">Locality Comparison Table</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="p-4 border-b border-r border-border-default bg-surface-secondary sticky left-0 z-20 min-w-[140px] max-w-[160px] align-bottom"
                  >
                    <span className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.08em]">
                      Metrics
                    </span>
                  </th>
                  {localities.map((loc) => (
                    <th
                      key={loc.locality_id}
                      scope="col"
                      className="p-4 border-b border-border-default bg-surface-primary min-w-[200px] w-[200px] align-bottom"
                    >
                      <h3 className="text-[15px] font-bold text-text-primary mb-1">
                        {loc.name}
                      </h3>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {/* BLR Score */}
                <tr>
                  <th
                    scope="row"
                    className="p-4 font-medium text-text-secondary border-r border-border-default bg-surface-secondary sticky left-0 z-10"
                  >
                    BLR Score
                  </th>
                  {localities.map((loc) => (
                    <td key={loc.locality_id} className="p-4 bg-surface-primary">
                      <span className="text-[20px] font-extrabold text-brand-primary tabular-nums">
                        {Math.round(loc.total_score)}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Rank */}
                <tr>
                  <th
                    scope="row"
                    className="p-4 font-medium text-text-secondary border-r border-border-default bg-surface-secondary sticky left-0 z-10"
                  >
                    Rank
                  </th>
                  {localities.map((loc) => (
                    <td key={loc.locality_id} className="p-4 bg-surface-primary">
                      {loc.rank > 0 ? (
                        <span className="text-[14px] font-bold text-text-primary tabular-nums">
                          #{loc.rank}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Rent Range */}
                <tr>
                  <th
                    scope="row"
                    className="p-4 font-medium text-text-secondary border-r border-border-default bg-surface-secondary sticky left-0 z-10"
                  >
                    Est. Rent
                  </th>
                  {localities.map((loc) => (
                    <td key={loc.locality_id} className="p-4 bg-surface-primary font-medium text-text-primary">
                      {renderRent(loc.affordability)}
                    </td>
                  ))}
                </tr>

                {/* Work Commute */}
                <tr>
                  <th
                    scope="row"
                    className="p-4 font-medium text-text-secondary border-r border-border-default bg-surface-secondary sticky left-0 z-10"
                  >
                    Commute Distance
                  </th>
                  {localities.map((loc) => (
                    <td key={loc.locality_id} className="p-4 bg-surface-primary text-text-primary tabular-nums">
                      {loc.raw_metrics.work_distance_km} km
                    </td>
                  ))}
                </tr>

                {/* Metro Distance */}
                <tr>
                  <th
                    scope="row"
                    className="p-4 font-medium text-text-secondary border-r border-border-default bg-surface-secondary sticky left-0 z-10"
                  >
                    Metro Access
                  </th>
                  {localities.map((loc) => (
                    <td key={loc.locality_id} className="p-4 bg-surface-primary text-text-primary tabular-nums">
                      {renderDistance(loc.raw_metrics.metro_distance_m)}
                    </td>
                  ))}
                </tr>

                {/* Cafes */}
                <tr>
                  <th
                    scope="row"
                    className="p-4 font-medium text-text-secondary border-r border-border-default bg-surface-secondary sticky left-0 z-10"
                  >
                    Cafes
                  </th>
                  {localities.map((loc) => (
                    <td key={loc.locality_id} className="p-4 bg-surface-primary text-text-primary">
                      {renderAmenity(loc.raw_metrics.cafe_accessibility)}
                    </td>
                  ))}
                </tr>

                {/* Restaurants */}
                <tr>
                  <th
                    scope="row"
                    className="p-4 font-medium text-text-secondary border-r border-border-default bg-surface-secondary sticky left-0 z-10"
                  >
                    Restaurants
                  </th>
                  {localities.map((loc) => (
                    <td key={loc.locality_id} className="p-4 bg-surface-primary text-text-primary">
                      {renderAmenity(loc.raw_metrics.restaurant_accessibility)}
                    </td>
                  ))}
                </tr>

                {/* Parks */}
                <tr>
                  <th
                    scope="row"
                    className="p-4 font-medium text-text-secondary border-r border-border-default bg-surface-secondary sticky left-0 z-10"
                  >
                    Parks
                  </th>
                  {localities.map((loc) => (
                    <td key={loc.locality_id} className="p-4 bg-surface-primary text-text-primary">
                      {renderAmenity(loc.raw_metrics.park_accessibility)}
                    </td>
                  ))}
                </tr>

                {/* Healthcare */}
                <tr>
                  <th
                    scope="row"
                    className="p-4 font-medium text-text-secondary border-r border-border-default bg-surface-secondary sticky left-0 z-10"
                  >
                    Healthcare
                  </th>
                  {localities.map((loc) => (
                    <td key={loc.locality_id} className="p-4 bg-surface-primary text-text-primary">
                      {renderAmenity(loc.raw_metrics.healthcare_accessibility)}
                    </td>
                  ))}
                </tr>

                {/* Nightlife */}
                <tr>
                  <th
                    scope="row"
                    className="p-4 font-medium text-text-secondary border-r border-border-default bg-surface-secondary sticky left-0 z-10"
                  >
                    Nightlife
                  </th>
                  {localities.map((loc) => (
                    <td key={loc.locality_id} className="p-4 bg-surface-primary text-text-primary">
                      {renderAmenity(loc.raw_metrics.nightlife_accessibility)}
                    </td>
                  ))}
                </tr>

                {/* Pros */}
                <tr>
                  <th
                    scope="row"
                    className="p-4 font-medium text-text-secondary border-r border-border-default bg-surface-secondary sticky left-0 z-10 align-top"
                  >
                    Pros
                  </th>
                  {localities.map((loc) => (
                    <td key={loc.locality_id} className="p-4 bg-surface-primary align-top">
                      {loc.explanations.pros.length > 0 ? (
                        <ul className="flex flex-col gap-2">
                          {loc.explanations.pros.map((pro, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <CheckCircle2
                                size={14}
                                className="text-success-text shrink-0 mt-0.5"
                              />
                              <span className="text-[13px] text-text-secondary leading-snug">
                                {pro}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Trade-offs */}
                <tr>
                  <th
                    scope="row"
                    className="p-4 font-medium text-text-secondary border-r border-border-default bg-surface-secondary sticky left-0 z-10 align-top"
                  >
                    Trade-offs
                  </th>
                  {localities.map((loc) => (
                    <td key={loc.locality_id} className="p-4 bg-surface-primary align-top">
                      {loc.explanations.warnings.length > 0 ? (
                        <ul className="flex flex-col gap-2">
                          {loc.explanations.warnings.map((warning, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <AlertTriangle
                                size={14}
                                className="text-warning-text shrink-0 mt-0.5"
                              />
                              <span className="text-[13px] text-text-secondary leading-snug">
                                {warning}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
