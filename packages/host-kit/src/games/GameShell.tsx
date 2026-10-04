import { type ReactNode } from 'react';
import { GameTheme, type GameThemeColors } from './GameTheme.js';

export interface GameShellProps {
  eyebrow: string;
  title: string;
  tagline: string;
  theme: GameThemeColors;
  children: ReactNode;
  footerLinks?: Array<{ label: string; href: string }>;
}

export function GameShell({ eyebrow, title, tagline, theme, children, footerLinks }: GameShellProps) {
  return (
    <GameTheme colors={theme}>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>
        <header
          className={`relative overflow-hidden bg-gradient-to-br ${theme.heroGradient} px-6 py-12 text-center`}
          style={{ boxShadow: `0 8px 64px 0 ${theme.glowColor}` }}
        >
          <p className={`text-xs font-semibold tracking-widest uppercase mb-2 opacity-70 ${theme.accentTextLight}`}>
            {eyebrow}
          </p>
          <h1 className="text-4xl font-black text-white">{title}</h1>
          <p className={`mt-2 text-sm opacity-80 ${theme.accentTextLight}`}>{tagline}</p>
        </header>
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 flex flex-col gap-4">
          {children}
        </main>
        <footer className="text-center text-xs py-6" style={{ color: 'var(--ink)', opacity: 0.7 }}>
          Made by Bilko{' '}·{' '}
          <a href="https://bilko.run" className="underline">bilko.run</a>
          {footerLinks?.map(l => (
            <span key={l.href}>
              {' '}·{' '}
              <a href={l.href} className="underline">{l.label}</a>
            </span>
          ))}
        </footer>
      </div>
    </GameTheme>
  );
}
