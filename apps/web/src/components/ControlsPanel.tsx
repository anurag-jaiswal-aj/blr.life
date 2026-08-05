import React, { useState } from 'react';
import { AppState } from '../hooks/useUrlState';
import { Briefcase, Train, Coffee, Utensils, TreePine, Stethoscope, Moon, ChevronDown, ChevronUp, Home } from 'lucide-react';

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
      <label className="text-label font-medium text-text-secondary flex items-center gap-2">
        <Icon size={14} className="text-text-muted" />
        {label}
      </label>
      <div className="flex bg-surface-secondary rounded-control p-1 border border-border-subtle">
        {[
          { label: 'Off', val: 0.0 },
          { label: 'Nice', val: 0.5 },
          { label: 'Must', val: 1.0 }
        ].map(opt => (
          <button
            key={opt.label}
            onClick={() => onChange(opt.val)}
            className={`flex-1 text-[10px] sm:text-xs py-1.5 rounded-sm font-medium transition-colors ${
              value === opt.val 
                ? 'bg-surface-primary text-brand-primary shadow-subtle' 
                : 'text-text-muted hover:text-text-secondary'
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
    <div className="bg-surface-primary p-4 md:p-6 rounded-card border border-border-default shadow-subtle flex flex-col gap-6">
      
      {/* Commute Controls (Top Row) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-label font-medium text-text-secondary flex items-center gap-2">
              <Briefcase size={16} className="text-text-muted" />
              Max Commute Distance
            </label>
            <span className="text-label font-bold text-brand-primary">{state.max_dist} km</span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            step="0.5"
            value={state.max_dist}
            onChange={(e) => updateState({ max_dist: parseFloat(e.target.value) })}
            className="w-full h-2 bg-surface-secondary rounded-full appearance-none cursor-pointer accent-brand-primary"
            aria-label="Maximum Commute Distance"
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-label font-medium text-text-secondary flex items-center gap-2">
              <Train size={16} className="text-text-muted" />
              Metro Importance
            </label>
            <span className="text-label font-bold text-brand-primary">{Math.round(state.w_metro * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={state.w_metro}
            onChange={(e) => updateState({ w_metro: parseFloat(e.target.value) })}
            className="w-full h-2 bg-surface-secondary rounded-full appearance-none cursor-pointer accent-brand-primary"
            aria-label="Metro Importance Weight"
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-label font-medium text-text-secondary flex items-center gap-2">
              <Briefcase size={16} className="text-text-muted" />
              Short Commute Importance
            </label>
            <span className="text-label font-bold text-brand-primary">{Math.round(state.w_work * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={state.w_work}
            onChange={(e) => updateState({ w_work: parseFloat(e.target.value) })}
            className="w-full h-2 bg-surface-secondary rounded-full appearance-none cursor-pointer accent-brand-primary"
            aria-label="Short Commute Importance Weight"
          />
        </div>
      </div>

      {/* Affordability & Lifestyle (Bottom Row) */}
      <div className="pt-6 border-t border-border-default grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Affordability */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-body font-bold text-text-primary flex items-center gap-2">
              <Home size={16} className="text-text-muted" />
              Affordability Filter
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-label font-medium text-text-secondary">Max Rent (₹)</label>
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
                className="w-full text-body p-2.5 bg-surface-primary border border-border-default rounded-control focus:outline-none focus:ring-2 focus:ring-brand-primary transition-shadow"
                aria-label="Max Rent Budget"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-label font-medium text-text-secondary">Property Type</label>
              <select
                value={state.bhk_type || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateState({ bhk_type: val ? (val as '1rk' | '1bhk' | '2bhk' | '3bhk') : null });
                }}
                className="w-full text-body p-2.5 bg-surface-primary border border-border-default rounded-control focus:outline-none focus:ring-2 focus:ring-brand-primary transition-shadow"
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
            <p className="text-label text-warning-text bg-warning-bg p-2 rounded-md border border-amber-200">Please provide both rent budget and property type.</p>
          ) : null}
        </div>

        {/* Lifestyle */}
        <div className="xl:border-l border-border-default xl:pl-6">
          <button 
            onClick={() => setLifestyleOpen(!lifestyleOpen)}
            className="flex items-center justify-between w-full text-left py-1 hover:opacity-80 transition-opacity focus-visible:rounded-sm"
          >
            <span className="text-body font-bold text-text-primary">Lifestyle Preferences</span>
            {lifestyleOpen ? <ChevronUp size={18} className="text-text-muted" /> : <ChevronDown size={18} className="text-text-muted" />}
          </button>
          
          {lifestyleOpen && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-4">
              <PrioritySelector label="Cafes" icon={Coffee} value={state.w_cafe} onChange={(v) => updateState({ w_cafe: v })} />
              <PrioritySelector label="Dining" icon={Utensils} value={state.w_restaurant} onChange={(v) => updateState({ w_restaurant: v })} />
              <PrioritySelector label="Parks" icon={TreePine} value={state.w_park} onChange={(v) => updateState({ w_park: v })} />
              <PrioritySelector label="Healthcare" icon={Stethoscope} value={state.w_healthcare} onChange={(v) => updateState({ w_healthcare: v })} />
              <PrioritySelector label="Nightlife" icon={Moon} value={state.w_nightlife} onChange={(v) => updateState({ w_nightlife: v })} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
