export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  secret?: boolean;
}

export interface GameConfig {
  slug: string;
  scoreOrder: 'asc' | 'desc';  // 'desc' = higher better; 'asc' = lower-time better
  maxPlausibleScore: number;
  achievements: AchievementDef[];
}

export interface CrossGameTrigger {
  otherSlug: string;
  otherKey: string;
  awardSlug: string;
  awardKey: string;
}

export const CROSS_GAME_TRIGGERS: Record<string, CrossGameTrigger> = {
  'sudoku:first_win':        { otherSlug: 'mindswiffer', otherKey: 'first_sweep', awardSlug: 'bilko', awardKey: 'puzzler' },
  'mindswiffer:first_sweep': { otherSlug: 'sudoku',      otherKey: 'first_win',   awardSlug: 'bilko', awardKey: 'puzzler' },
};

export const GAME_CONFIGS: Record<string, GameConfig> = {
  'boat-shooter': {
    slug: 'boat-shooter',
    scoreOrder: 'desc',
    maxPlausibleScore: 1_000_000,
    achievements: [
      { key: 'first_kill', name: 'First Blood', description: 'Land your first hit.', icon: '🎯' },
    ],
  },
  'sudoku': {
    slug: 'sudoku',
    scoreOrder: 'desc',
    maxPlausibleScore: 0,
    achievements: [
      { key: 'first_win', name: 'First win', description: 'Solve your first Sudoku.', icon: '🔢' },
    ],
  },
  'mindswiffer': {
    slug: 'mindswiffer',
    scoreOrder: 'asc',
    maxPlausibleScore: 3_600_000,
    achievements: [
      { key: 'first_sweep',          name: 'First sweep',       description: 'Win your first MindSwiffer.',                    icon: '💣' },
      { key: 'beginner_sub_60',      name: 'Sub-60 Beginner',   description: 'Win Beginner in under 60 seconds.',               icon: '⚡' },
      { key: 'intermediate_sub_180', name: 'Sub-3 Intermediate', description: 'Win Intermediate in under 3 minutes.',           icon: '⚡⚡' },
      { key: 'expert_win',           name: 'Expert sweeper',    description: 'Win on Expert difficulty.',                       icon: '🏆' },
      { key: 'streak_7',             name: 'Week-long sweep',   description: '7-day daily streak.',                            icon: '🔥' },
      { key: 'no_flag_win',          name: 'Flagless',          description: 'Win without placing a single flag.',              icon: '🧠' },
      { key: 'no_hint_intermediate', name: 'Pure deduction',    description: 'Win Intermediate without using a hint.',         icon: '🪶' },
    ],
  },
  'etch': {
    slug: 'etch',
    scoreOrder: 'desc',
    maxPlausibleScore: 0,
    achievements: [
      { key: 'first_solve', name: 'First sketch', description: 'Solve your first Etch nonogram.', icon: '🖼️' },
    ],
  },
  'bilko': {
    slug: 'bilko',
    scoreOrder: 'desc',
    maxPlausibleScore: 0,
    achievements: [
      { key: 'puzzler', name: 'Puzzler', description: 'Solve your first Sudoku and your first MindSwiffer.', icon: '🧩' },
      // TODO: Triple Threat — solve Sudoku + MindSwiffer + Etch (PRD 116).
      // The existing CROSS_GAME_TRIGGERS only supports 2-game triggers. A 3-game
      // "triple_threat" achievement needs a different trigger shape — track as a follow-up.
      { key: 'triple_threat', name: 'Triple Threat', description: 'Solve your first Sudoku, MindSwiffer, AND Etch.', icon: '🎯', secret: true },
    ],
  },
};
