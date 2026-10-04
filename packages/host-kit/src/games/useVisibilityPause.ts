import { useEffect } from 'react';

export function useVisibilityPause(onPause: () => void, onResume: () => void) {
  useEffect(() => {
    const h = () => { document.hidden ? onPause() : onResume(); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [onPause, onResume]);
}
