import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: ReactNode;
  lede?: string;
  what?: string;
}

export function PageHeader({ eyebrow, title, lede, what }: Props) {
  return (
    <div className="pf-page-header">
      <div className="pf-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {lede && <p className="pf-lede">{lede}</p>}
      {what && (
        <div className="pf-what-this-is">
          <span className="pf-label">What this is →</span>
          <span>{what}</span>
        </div>
      )}
    </div>
  );
}
