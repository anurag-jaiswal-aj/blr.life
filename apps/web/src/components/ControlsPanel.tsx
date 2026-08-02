import React from 'react';
import { AppState } from '../hooks/useUrlState';
import { Briefcase, Train } from 'lucide-react';
import { WorkLocationInput } from './WorkLocationInput';

interface ControlsPanelProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
}

export function ControlsPanel({ state, updateState }: ControlsPanelProps) {
  return (
    <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-gray-100 flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">blr.life</h2>
        <p className="text-sm text-gray-500">Find your ideal Bengaluru neighbourhood.</p>
      </div>

      <WorkLocationInput state={state} updateState={updateState} />

      {state.lat !== null && state.lng !== null && (
        <div className="flex flex-col gap-5">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Briefcase size={16} className="text-gray-400" />
                Max Commute Distance
              </label>
              <span className="text-sm font-bold text-indigo-600">{state.max_dist} km</span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              step="0.5"
              value={state.max_dist}
              onChange={(e) => updateState({ max_dist: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              aria-label="Maximum Commute Distance"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Train size={16} className="text-gray-400" />
                Metro Importance
              </label>
              <span className="text-sm font-bold text-indigo-600">{Math.round(state.w_metro * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={state.w_metro}
              onChange={(e) => updateState({ w_metro: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              aria-label="Metro Importance Weight"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Briefcase size={16} className="text-gray-400" />
                Short Commute Importance
              </label>
              <span className="text-sm font-bold text-indigo-600">{Math.round(state.w_work * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={state.w_work}
              onChange={(e) => updateState({ w_work: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              aria-label="Short Commute Importance Weight"
            />
          </div>
        </div>
      )}
    </div>
  );
}
