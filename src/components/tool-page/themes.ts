/** Tool-specific color themes — each tool gets visual personality */

export interface ToolTheme {
  /** Gradient for hero/scorecard dark backgrounds */
  heroGradient: string;
  /** Radial overlay color (rgba) */
  glowColor: string;
  /** Label/accent text color */
  accentText: string;
  /** Accent for light backgrounds (verdicts, highlights) */
  accentTextLight: string;
  /** Button bg + hover */
  buttonBg: string;
  buttonHover: string;
  /** Shadow color for CTA buttons */
  buttonShadow: string;
}

export const TOOL_THEMES: Record<string, ToolTheme> = {
  'page-roast': {
    heroGradient: 'from-warm-900 via-warm-950 to-warm-900',
    glowColor: 'rgba(255,107,26,0.12)',
    accentText: 'text-fire-400',
    accentTextLight: 'text-fire-500',
    buttonBg: 'bg-fire-500',
    buttonHover: 'hover:bg-fire-600',
    buttonShadow: 'shadow-fire-900/30',
  },
  'headline-grader': {
    heroGradient: 'from-[#1a1530] via-[#0f0d1a] to-[#1a1530]',
    glowColor: 'rgba(99,102,241,0.14)',
    accentText: 'text-indigo-400',
    accentTextLight: 'text-indigo-500',
    buttonBg: 'bg-indigo-500',
    buttonHover: 'hover:bg-indigo-600',
    buttonShadow: 'shadow-indigo-900/30',
  },
  'ad-scorer': {
    heroGradient: 'from-[#0d1f17] via-[#0a1510] to-[#0d1f17]',
    glowColor: 'rgba(16,185,129,0.14)',
    accentText: 'text-emerald-400',
    accentTextLight: 'text-emerald-500',
    buttonBg: 'bg-emerald-500',
    buttonHover: 'hover:bg-emerald-600',
    buttonShadow: 'shadow-emerald-900/30',
  },
  'thread-grader': {
    heroGradient: 'from-[#0c1929] via-[#080f1a] to-[#0c1929]',
    glowColor: 'rgba(14,165,233,0.14)',
    accentText: 'text-sky-400',
    accentTextLight: 'text-sky-500',
    buttonBg: 'bg-sky-500',
    buttonHover: 'hover:bg-sky-600',
    buttonShadow: 'shadow-sky-900/30',
  },
  'email-forge': {
    heroGradient: 'from-[#1f1a0d] via-[#15100a] to-[#1f1a0d]',
    glowColor: 'rgba(245,158,11,0.14)',
    accentText: 'text-amber-400',
    accentTextLight: 'text-amber-500',
    buttonBg: 'bg-amber-500',
    buttonHover: 'hover:bg-amber-600',
    buttonShadow: 'shadow-amber-900/30',
  },
  'audience-decoder': {
    heroGradient: 'from-[#1a0f2e] via-[#120a1f] to-[#1a0f2e]',
    glowColor: 'rgba(168,85,247,0.14)',
    accentText: 'text-purple-400',
    accentTextLight: 'text-purple-500',
    buttonBg: 'bg-purple-500',
    buttonHover: 'hover:bg-purple-600',
    buttonShadow: 'shadow-purple-900/30',
  },
  'launch-grader': {
    heroGradient: 'from-[#0d1f1d] via-[#0a1513] to-[#0d1f1d]',
    glowColor: 'rgba(20,184,166,0.14)',
    accentText: 'text-teal-400',
    accentTextLight: 'text-teal-500',
    buttonBg: 'bg-teal-500',
    buttonHover: 'hover:bg-teal-600',
    buttonShadow: 'shadow-teal-900/30',
  },
  'stack-audit': {
    heroGradient: 'from-[#151a20] via-[#0f1318] to-[#151a20]',
    glowColor: 'rgba(100,116,139,0.14)',
    accentText: 'text-slate-400',
    accentTextLight: 'text-slate-500',
    buttonBg: 'bg-slate-600',
    buttonHover: 'hover:bg-slate-700',
    buttonShadow: 'shadow-slate-900/30',
  },
  'stepproof': {
    heroGradient: 'from-[#0d1c1f] via-[#0a1315] to-[#0d1c1f]',
    glowColor: 'rgba(6,182,212,0.14)',
    accentText: 'text-cyan-400',
    accentTextLight: 'text-cyan-500',
    buttonBg: 'bg-cyan-500',
    buttonHover: 'hover:bg-cyan-600',
    buttonShadow: 'shadow-cyan-900/30',
  },
  'local-score': {
    heroGradient: 'from-[#0d1f12] via-[#0a150d] to-[#0d1f12]',
    glowColor: 'rgba(34,197,94,0.14)',
    accentText: 'text-green-400',
    accentTextLight: 'text-green-500',
    buttonBg: 'bg-green-500',
    buttonHover: 'hover:bg-green-600',
    buttonShadow: 'shadow-green-900/30',
  },
};

/** Get theme for a tool slug, falls back to page-roast (fire) */
export function getToolTheme(slug: string): ToolTheme {
  return TOOL_THEMES[slug] ?? TOOL_THEMES['page-roast'];
}
