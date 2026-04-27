import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SECTIONS, PORTFOLIO_PROJECTS } from '../../data/portfolio.js';

interface Item {
  kind: string;
  ic: string;
  name: string;
  desc: string;
  path: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      ...SECTIONS.map(s => ({ kind: 'Section', ic: s.icon, name: s.label, desc: s.desc, path: s.path })),
      ...PORTFOLIO_PROJECTS.map(p => ({ kind: 'Project', ic: '◐', name: p.name, desc: p.kind, path: `/work/${p.id}` })),
    ];
    if (!query) return all.slice(0, 12);
    const q = query.toLowerCase();
    return all.filter(i => (i.name + ' ' + i.desc + ' ' + i.kind).toLowerCase().includes(q)).slice(0, 12);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
      else if (e.key === 'Enter')     { e.preventDefault(); const it = items[active]; if (it) { navigate(it.path); onClose(); } }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, items, active, onClose, navigate]);

  if (!open) return null;
  return (
    <div className="pf-cmdk-overlay" onClick={onClose}>
      <div className="pf-cmdk" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setActive(0); }}
          placeholder="Jump to anything…"
        />
        <div className="pf-results">
          {items.length === 0 && (
            <div style={{ padding: '24px 20px', fontFamily: 'var(--pf-font-mono)', fontSize: 12, color: 'var(--pf-ink-3)' }}>
              No results. Try "projects", "blog", or "games".
            </div>
          )}
          {items.map((it, i) => (
            <div
              key={i}
              className={'pf-row ' + (i === active ? 'active' : '')}
              onMouseEnter={() => setActive(i)}
              onClick={() => { navigate(it.path); onClose(); }}
            >
              <span className="pf-ic">{it.ic}</span>
              <span className="pf-name">{it.name}</span>
              <span className="pf-desc">{it.kind}</span>
            </div>
          ))}
        </div>
        <div className="pf-foot">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
