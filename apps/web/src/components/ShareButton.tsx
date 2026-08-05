import React, { useState, useEffect } from 'react';
import { Share2, Check, AlertCircle } from 'lucide-react';

export function ShareButton() {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (status !== 'idle') {
      const timer = setTimeout(() => setStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary border border-border-default rounded-control text-label font-bold text-text-primary hover:bg-surface-app focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-1 transition-colors"
      aria-label="Share results"
    >
      {status === 'success' && <Check size={14} className="text-success-text" />}
      {status === 'error' && <AlertCircle size={14} className="text-error-text" />}
      {status === 'idle' && <Share2 size={14} className="text-text-secondary" />}
      <span aria-live="polite">
        {status === 'success' ? 'Copied' : status === 'error' ? 'Copy failed' : 'Share'}
      </span>
    </button>
  );
}
