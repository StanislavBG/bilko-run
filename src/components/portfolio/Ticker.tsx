import { TICKER_ITEMS } from '../../data/portfolio.js';

export function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="pf-ticker">
      <div className="pf-track">
        {items.map((it, i) => (
          <span key={i}><span className="pf-dot">●</span> {it}</span>
        ))}
      </div>
    </div>
  );
}
