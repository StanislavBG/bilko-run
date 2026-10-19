import { useCallback, useEffect, useRef, useState } from 'react';
import '../../styles/forum.css';

/** Tiny shared toast: `flash(msg)` shows it for ~2.6s; render `toast` once. */
export function useForumToast() {
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const flash = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 2600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const toast = msg ? <div className="fm-toast" role="status">{msg}</div> : null;
  return { flash, toast };
}
