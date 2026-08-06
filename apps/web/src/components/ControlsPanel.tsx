import React from 'react';
import { AppState } from '../hooks/useUrlState';
import { Coffee, Utensils, TreePine, Stethoscope, Moon } from 'lucide-react';
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
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
        <Icon size={14} className="text-text-muted" aria-hidden="true" />
        {label}
      </label>
      <div className="flex bg-surface-secondary rounded-md p-0.5 border border-border-default">
        {[
          { label: 'Off', val: 0.0 },
          { label: 'Nice', val: 0.5 },
          { label: 'Must', val: 1.0 }
        ].map(opt => (
          <button
            key={opt.label}
            onClick={() => onChange(opt.val)}
            type="button"
            className={`flex-1 text-[11px] py-1 rounded-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${
              value === opt.val 
                ? 'bg-surface-primary text-brand-primary shadow-subtle' 
                : 'text-text-muted hover:text-text-primary'
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
  const isBudgetIncomplete = 
    (state.max_budget_inr !== null && state.bhk_type === null) || 
    (state.max_budget_inr === null && state.bhk_type !== null);

  return (
    <div className="w-full h-full flex flex-col gap-6 p-4 md:p-6 overflow-y-auto bg-surface-primary md:border-r border-border-default">
      
      {/* Workplace Section */}
      <div className="flex flex-col">
        <WorkLocationInput state={state} updateState={updateState} />
      </div>

      <div className="w-full h-px bg-border-subtle" aria-hidden="true"></div>
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Budget & Home</h3>
            
            <div className="flex flex-col gap-4">
              {/* Rent */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="max_budget_inr" className="text-sm font-medium text-text-primary">Max Rent</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none select-none" aria-hidden="true">₹</span>
                  <input
                    id="max_budget_inr"
                    type="number"
                    min="1000"
                    step="1000"
                    placeholder="Optional"
                    value={state.max_budget_inr || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateState({ max_budget_inr: isNaN(val) ? null : val });
                    }}
                    className="w-full text-sm pl-7 pr-3 py-2 bg-surface-secondary border border-border-default rounded-md focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all placeholder:text-text-muted/60"
                    aria-label="Max Rent Budget"
                  />
                </div>
              </div>
              
              {/* Property Type */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="bhk_type" className="text-sm font-medium text-text-primary">Property Type</label>
                <select
                  id="bhk_type"
                  value={state.bhk_type || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateState({ bhk_type: val ? (val as '1rk' | '1bhk' | '2bhk' | '3bhk') : null });
                  }}
                  className="w-full text-sm px-3 py-2 bg-surface-secondary border border-border-default rounded-md focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all text-text-primary appearance-none cursor-pointer"
                  aria-label="Property Type"
                >
                  <option value="">Any (Optional)</option>
                  <option value="1rk">1 RK</option>
                  <option value="1bhk">1 BHK</option>
                  <option value="2bhk">2 BHK</option>
                  <option value="3bhk">3 BHK</option>
                </select>
              </div>
            </div>
            
            {isBudgetIncomplete && (
              <p className="text-xs text-warning-text flex items-start gap-1.5 mt-1" role="alert">
                <span className="w-1.5 h-1.5 mt-1 rounded-full bg-warning-bg border border-warning-text/50 shrink-0"></span>
                Both budget and property type are required if one is set.
              </p>
            )}
          </div>

      <div className="w-full h-px bg-border-subtle" aria-hidden="true"></div>

      {/* Proximity Constraints */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Proximity & Logistics</h3>
        
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label htmlFor="max_dist" className="text-sm font-medium text-text-primary">Maximum Commute Distance</label>
              <span className="text-sm font-bold text-brand-primary tabular-nums">{state.max_dist} km</span>
            </div>
            <input 
              id="max_dist"
              type="range" 
              min="1"
              max="30"
              step="0.5"
              value={state.max_dist}
              onChange={(e) => updateState({ max_dist: parseFloat(e.target.value) })}
              className="w-full h-1 bg-border-default rounded-full appearance-none accent-brand-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50" 
              aria-label="Maximum Commute Distance"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label htmlFor="w_work" className="text-sm font-medium text-text-primary">Short Commute</label>
              <span className="text-sm font-bold text-brand-primary tabular-nums">{Math.round(state.w_work * 100)}%</span>
            </div>
            <input 
              id="w_work"
              type="range" 
              min="0"
              max="1"
              step="0.1"
              value={state.w_work}
              onChange={(e) => updateState({ w_work: parseFloat(e.target.value) })}
              className="w-full h-1 bg-border-default rounded-full appearance-none accent-brand-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50" 
              aria-label="Short Commute Importance Weight"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label htmlFor="w_metro" className="text-sm font-medium text-text-primary">Metro Access</label>
              <span className="text-sm font-bold text-brand-primary tabular-nums">{Math.round(state.w_metro * 100)}%</span>
            </div>
            <input 
              id="w_metro"
              type="range" 
              min="0"
              max="1"
              step="0.1"
              value={state.w_metro}
              onChange={(e) => updateState({ w_metro: parseFloat(e.target.value) })}
              className="w-full h-1 bg-border-default rounded-full appearance-none accent-brand-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50" 
              aria-label="Metro Importance Weight"
            />
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-border-subtle" aria-hidden="true"></div>

      {/* Lifestyle Preferences */}
      <div className="flex flex-col gap-4 pb-4">
        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Lifestyle Preferences</h3>
        
        <div className="flex flex-col gap-4">
          <PrioritySelector label="Cafes" icon={Coffee} value={state.w_cafe} onChange={(v) => updateState({ w_cafe: v })} />
          <PrioritySelector label="Dining" icon={Utensils} value={state.w_restaurant} onChange={(v) => updateState({ w_restaurant: v })} />
          <PrioritySelector label="Parks" icon={TreePine} value={state.w_park} onChange={(v) => updateState({ w_park: v })} />
          <PrioritySelector label="Healthcare" icon={Stethoscope} value={state.w_healthcare} onChange={(v) => updateState({ w_healthcare: v })} />
          <PrioritySelector label="Nightlife" icon={Moon} value={state.w_nightlife} onChange={(v) => updateState({ w_nightlife: v })} />
        </div>
      </div>
    </div>
  );
}
