import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ControlsPanel } from './ControlsPanel';
import { Settings2, X } from 'lucide-react';
import { AppState } from '../hooks/useUrlState';

interface ControlsDisclosureProps {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
}

export function ControlsDisclosure({ state, updateState }: ControlsDisclosureProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <>
      <button 
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-surface-secondary border border-border-default rounded-control text-label font-semibold text-text-primary hover:bg-border-default transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 shrink-0"
      >
        <Settings2 size={16} />
        <span>Refine</span>
      </button>

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[100] md:inset-y-0 md:left-auto md:right-0 md:w-96 md:border-l md:border-border-default md:shadow-2xl bg-surface-app flex flex-col animate-in fade-in duration-200 md:slide-in-from-right-4">
          <div className="flex items-center justify-between px-4 py-4 bg-surface-primary border-b border-border-default shrink-0">
            <h2 className="text-card-title font-bold text-text-primary">Refine recommendations</h2>
            <button 
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-full hover:bg-surface-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 text-text-secondary hover:text-text-primary"
              aria-label="Close filters"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6 pb-12">
            <ControlsPanel state={state} updateState={updateState} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
