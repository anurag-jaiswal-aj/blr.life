import React, { useState } from 'react';
import { AppState } from '../hooks/useUrlState';
import { Briefcase, Train, Coffee, Utensils, TreePine, Stethoscope, Moon, ChevronDown, ChevronUp, Home } from 'lucide-react';
import { WorkLocationInput } from './WorkLocationInput';

interface ControlsPanelProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
}

const PrioritySelector = ({ 
  value, 
  onChange, 
  label, 
  icon: Icon 
}: { 
  value: number, 
  onChange: (v: number) => void, 
  label: string, 
  icon: React.ElementType 
}) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Icon size={16} className="text-gray-400" />
        {label}
      </label>
      <div className="flex bg-gray-100 rounded-lg p-1">
        {[
          { label: 'Off', val: 0.0 },
          { label: 'Nice', val: 0.5 },
          { label: 'Must', val: 1.0 }
        ].map(opt => (
          <button
            key={opt.label}
            onClick={() => onChange(opt.val)}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
              value === opt.val 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export function ControlsPanel({ state, updateState }: ControlsPanelProps) {
  const [lifestyleOpen, setLifestyleOpen] = useState(false);

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

          <div className="pt-2 border-t border-gray-100 space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Home size={16} className="text-gray-400" />
                Affordability Filter
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-700">Max Rent (₹)</label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  placeholder="e.g. 25000"
                  value={state.max_budget_inr || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    updateState({ max_budget_inr: isNaN(val) ? null : val });
                  }}
                  className="w-full text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  aria-label="Max Rent Budget"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-700">Property Type</label>
                <select
                  value={state.bhk_type || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateState({ bhk_type: val ? (val as '1rk' | '1bhk' | '2bhk' | '3bhk') : null });
                  }}
                  className="w-full text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  aria-label="Property Type"
                >
                  <option value="">Any</option>
                  <option value="1rk">1 RK</option>
                  <option value="1bhk">1 BHK</option>
                  <option value="2bhk">2 BHK</option>
                  <option value="3bhk">3 BHK</option>
                </select>
              </div>
            </div>
            {(state.max_budget_inr !== null && state.bhk_type === null) || (state.max_budget_inr === null && state.bhk_type !== null) ? (
              <p className="text-xs text-amber-600">Please provide both rent budget and property type.</p>
            ) : null}
          </div>

          <div className="pt-2 border-t border-gray-100">
            <button 
              onClick={() => setLifestyleOpen(!lifestyleOpen)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-sm font-bold text-gray-800">Lifestyle Preferences</span>
              {lifestyleOpen ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
            </button>
            
            {lifestyleOpen && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <PrioritySelector label="Cafes" icon={Coffee} value={state.w_cafe} onChange={(v) => updateState({ w_cafe: v })} />
                <PrioritySelector label="Dining" icon={Utensils} value={state.w_restaurant} onChange={(v) => updateState({ w_restaurant: v })} />
                <PrioritySelector label="Parks" icon={TreePine} value={state.w_park} onChange={(v) => updateState({ w_park: v })} />
                <PrioritySelector label="Healthcare" icon={Stethoscope} value={state.w_healthcare} onChange={(v) => updateState({ w_healthcare: v })} />
                <PrioritySelector label="Nightlife" icon={Moon} value={state.w_nightlife} onChange={(v) => updateState({ w_nightlife: v })} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
