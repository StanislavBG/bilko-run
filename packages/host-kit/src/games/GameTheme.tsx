import { createContext, useContext, type ReactNode } from 'react';

export interface GameThemeColors {
  heroGradient: string;
  glowColor: string;
  accentText: string;
  accentTextLight: string;
}

const Ctx = createContext<GameThemeColors | null>(null);

export function GameTheme({ colors, children }: { colors: GameThemeColors; children: ReactNode }) {
  return <Ctx.Provider value={colors}>{children}</Ctx.Provider>;
}

export function useGameTheme(): GameThemeColors {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGameTheme must be used inside <GameTheme>');
  return ctx;
}
