import React, { useState, useEffect, useRef } from 'react';
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !mounted) return;

    const dialogNode = dialogRef.current;
    if (!dialogNode) return;

    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const getFocusableElements = () => Array.from(dialogNode.querySelectorAll<HTMLElement>(focusableSelectors));

    const currentTrigger = triggerRef.current;

    // Focus first element initially
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to trigger
      currentTrigger?.focus();
    };
  }, [open, mounted]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-surface-secondary border border-border-default rounded-control text-label font-semibold text-text-primary hover:bg-border-default transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 shrink-0"
        aria-expanded={open}
      >
        <Settings2 size={16} />
        <span>Refine</span>
      </button>

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="refine-dialog-title"
            className="absolute inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-96 md:border-l md:border-border-default md:shadow-2xl bg-surface-app flex flex-col animate-in fade-in duration-200 md:slide-in-from-right-4"
          >
            <div className="flex items-center justify-between px-4 py-4 bg-surface-primary border-b border-border-default shrink-0">
              <h2 id="refine-dialog-title" className="text-card-title font-bold text-text-primary">Refine recommendations</h2>
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
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
