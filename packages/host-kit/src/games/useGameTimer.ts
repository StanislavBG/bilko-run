import { useCallback, useEffect, useRef, useState } from 'react';

export function useGameTimer({ paused }: { paused: boolean }) {
  const [ms, setMs] = useState(0);
  const msRef = useRef(ms);
  msRef.current = ms;

  useEffect(() => {
    if (paused) return;
    const start = Date.now() - msRef.current;
    const id = window.setInterval(() => setMs(Date.now() - start), 250);
    return () => window.clearInterval(id);
  }, [paused]);

  return {
    ms,
    reset: useCallback(() => setMs(0), []),
    pause: () => {},
    resume: () => {},
  };
}
