import React from 'react';
import { RecommendationResult } from '../lib/api';
import { CheckCircle2, AlertTriangle, Train, MapPin } from 'lucide-react';

interface ResultCardProps {
  result: RecommendationResult;
}

export function ResultCard({ result }: ResultCardProps) {
  const isMetroUnavailable = result.component_scores.metro === null;
  const scoreColor = result.total_score > 80 ? 'text-green-600' : result.total_score > 50 ? 'text-yellow-600' : 'text-orange-600';
  const scoreBg = result.total_score > 80 ? 'bg-green-50' : result.total_score > 50 ? 'bg-yellow-50' : 'bg-orange-50';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md">
      <div className="p-4 flex items-start justify-between border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full ${scoreBg} ${scoreColor} font-bold flex items-center justify-center text-sm`}>
            {result.rank}
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{result.name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin size={12} /> {result.raw_metrics.work_distance_km} km
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Train size={12} /> {isMetroUnavailable ? 'Unavailable' : `${result.raw_metrics.metro_distance_m}m`}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black ${scoreColor}`}>
            {result.total_score}
          </div>
          <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">BLR Score</div>
        </div>
      </div>

      <div className="p-4 bg-gray-50/50 space-y-2">
        {result.explanations.pros.map((pro, i) => (
          <div key={i} className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
            <span className="text-sm text-gray-700">{pro}</span>
          </div>
        ))}
        {result.explanations.warnings.map((warning, i) => (
          <div key={i} className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <span className="text-sm text-gray-700">{warning}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
