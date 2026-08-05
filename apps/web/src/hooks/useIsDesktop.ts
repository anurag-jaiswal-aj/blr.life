import { useState, useEffect } from 'react';

export function useIsDesktop() {
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    // Tailwind's 'lg' breakpoint is 1024px
    const mql = window.matchMedia('(min-width: 1024px)');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(mql.matches);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);

    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    // Safari < 14 support for addListener
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
    } else {
      mql.addListener(handler);
    }

    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handler);
      } else {
        mql.removeListener(handler);
      }
    };
  }, []);

  return { isDesktop, mounted };
}
