/**
 * Single source of truth for all tools.
 *
 * Adding a new tool requires editing ONLY this file plus creating the page
 * component. Everything downstream (homepage grid, /products listing, nav
 * dropdown, routing, tool-page theming, cross-promo) reads from here.
 *
 * Each tool owns its visual identity via `accent` + `theme`. Tools are free
 * to pick radically different aesthetics — this registry does not enforce a
 * house style.
 */

import React from 'react';
import { PRODUCT_KEYS, type ProductKey } from '../../shared/product-catalog.js';

/* ── Types ───────────────────────────────────────────────── */

export type ToolCategory = 'content' | 'business' | 'devtools';
export type ToolStatus = 'live' | 'beta' | 'coming-soon';
export type ToolTag = 'Marketing' | 'Ops' | 'Dev' | 'Free';

export interface ToolAccent {
  /** Tailwind text color class, e.g. `text-fire-500` */
  text: string;
  /** Tailwind bg color class — used for dot markers and solid fills */
  bg: string;
  /** Tailwind hover border class, e.g. `hover:border-fire-300` */
  hoverBorder: string;
}

export interface ToolTheme {
  /** Gradient for hero/scorecard dark backgrounds */
  heroGradient: string;
  /** Radial overlay color (rgba) */
  glowColor: string;
  /** Label/accent text color on dark */
  accentText: string;
  /** Accent for light backgrounds (verdicts, highlights) */
  accentTextLight: string;
  /** Button bg + hover */
  buttonBg: string;
  buttonHover: string;
  /** Shadow color for CTA buttons */
  buttonShadow: string;
}

export interface ToolCrossPromo {
  slug: string;
  hook: string;
}

/** Nav visibility. Each slot is either undefined (hidden) or an options object. */
export interface ToolNavConfig {
  /** Options if this tool appears in the Products dropdown */
  dropdown?: {
    /** Shorter tagline override for the cramped dropdown layout */
    desc?: string;
    /** Short badge like "Free" */
    badge?: string;
    /** Feature chips shown under the tagline */
    features?: readonly string[];
  };
  /** Options if this tool appears on the homepage grid */
  home?: {
    tag: ToolTag;
    /** Shorter desc override for the home row */
    desc?: string;
    /** Marks this as the FREE variant (green pill, no paywall) */
    free?: boolean;
  };
  /**
   * Hide from the /products listing page. Omit to show (the default).
   * Tools under development can set `listing: false` to stay internal.
   */
  listing?: false;
}

export type ToolLoader = () => Promise<{ default: React.ComponentType }>;

export interface ToolDefinition {
  /** URL slug and lookup key — must be unique */
  slug: string;
  /** Display name, e.g. "PageRoast" */
  name: string;
  /** Short tagline shown under the name */
  tagline: string;
  /** Long-form description for product cards */
  description: string;
  /** Bullet list of features (for product cards) */
  features: readonly string[];
  category: ToolCategory;
  status: ToolStatus;

  /** Visual identity (cards, badges, accents) */
  accent: ToolAccent;
  /** Dark hero/scorecard theme */
  theme: ToolTheme;

  /** Where this tool shows up in the site chrome */
  nav?: ToolNavConfig;

  /** Suggestions shown at the bottom of this tool's page */
  crossPromo?: readonly ToolCrossPromo[];

  /** React.lazy loader for the page component */
  loader?: ToolLoader;

  /** Stripe product key for one-off purchases — see shared/product-catalog */
  productKey?: ProductKey;
}

/** Tailwind classes for the homepage tag pill — one entry per ToolTag. */
export const TAG_COLORS: Record<ToolTag, string> = {
  Marketing: 'bg-warm-100/80 text-warm-500',
  Ops: 'bg-sky-50 text-sky-600',
  Dev: 'bg-violet-50 text-violet-600',
  Free: 'bg-green-50 text-green-600',
};

/* ── Registry ────────────────────────────────────────────── */

export const TOOLS: readonly ToolDefinition[] = [
  // PageRoast moved to its own repo (~/Projects/Page-Roast, github.com/StanislavBG/page-roast).
  // Now served as a static-path sibling at /projects/page-roast/ — see src/data/standalone-projects.json.
  // (PAGEROAST_TOKENS one-time-purchase tier remains server-side, transparent to the standalone client.)
  // HeadlineGrader moved to its own repo (~/Projects/Headline-Grader, github.com/StanislavBG/headline-grader).
  // Now served as a static-path sibling at /projects/headline-grader/ — see src/data/standalone-projects.json.
  // AdScorer moved to its own repo (~/Projects/Ad-Scorer, github.com/StanislavBG/ad-scorer).
  // Now served as a static-path sibling at /projects/ad-scorer/ — see src/data/standalone-projects.json.
  // ThreadGrader moved to its own repo (~/Projects/Thread-Grader, github.com/StanislavBG/thread-grader).
  // Now served as a static-path sibling at /projects/thread-grader/ — see src/data/standalone-projects.json.
  // EmailForge moved to its own repo (~/Projects/Email-Forge, github.com/StanislavBG/email-forge).
  // Now served as a static-path sibling at /projects/email-forge/ — see src/data/standalone-projects.json.
  // AudienceDecoder moved to its own repo (~/Projects/Audience-Decoder, github.com/StanislavBG/audience-decoder).
  // Now served as a static-path sibling at /projects/audience-decoder/ — see src/data/standalone-projects.json.
  // (One-time-purchase tier remains server-side, transparent to the standalone client.)
  // LaunchGrader moved to its own repo (~/Projects/Launch-Grader) and is now hosted
  // as a static-path project — see standalone-projects.json. The server route
  // at /api/demos/launch-grader stays in this repo; the standalone calls it
  // same-origin.
  // StackAudit moved to its own repo (~/Projects/Stack-Audit) and is now hosted
  // as a static-path project — see standalone-projects.json. The server route
  // at /api/demos/stack-audit stays in this repo; the standalone calls it
  // same-origin.
  // LocalScore moved to its own repo (~/Projects/Local-Score) and ships as a
  // static-path project — see STANDALONE_PROJECTS in projectsRegistry.ts.
  // This removes the ~6MB web-llm chunk from the host bundle entirely.
  // Stepproof moved to its own repo (~/Projects/Stepproof) and is now hosted
  // as a static-path project — see standalone-projects.json.
  // OutdoorHours moved to its own repo (~/Projects/Outdoor-Hours) and is now
  // hosted as a static-path project — see STANDALONE_PROJECTS in
  // src/data/projectsRegistry.ts. Keeping it out of this list means it no
  // longer ships with the main bundle.
  {
    slug: 'agent-trace',
    name: 'AgentTrace',
    tagline: 'Local observability for AI agents',
    description: 'Wrap any agent command with OpenTelemetry spans. SQLite storage, zero cloud dependency. See what your agents actually do.',
    features: ['OpenTelemetry GenAI spans', 'Local SQLite storage', 'Zero cloud', 'CLI interface'],
    category: 'devtools',
    status: 'coming-soon',
    accent: { text: 'text-warm-500', bg: 'bg-warm-400', hoverBorder: 'hover:border-warm-300' },
    theme: {
      heroGradient: 'from-warm-900 via-warm-950 to-warm-900',
      glowColor: 'rgba(107,107,107,0.10)',
      accentText: 'text-warm-300',
      accentTextLight: 'text-warm-500',
      buttonBg: 'bg-warm-600',
      buttonHover: 'hover:bg-warm-700',
      buttonShadow: 'shadow-warm-900/30',
    },
  },
];

/* ── Accessors ───────────────────────────────────────────── */

const BY_SLUG: Record<string, ToolDefinition> = Object.fromEntries(
  TOOLS.map(t => [t.slug, t]),
);

/** Lookup a tool definition by slug. Returns undefined if not found. */
export function getTool(slug: string): ToolDefinition | undefined {
  return BY_SLUG[slug];
}

/** Tools shown in the homepage tool grid, in registry order. */
export const HOME_TOOLS: readonly ToolDefinition[] = TOOLS.filter(t => !!t.nav?.home);

/** Tools shown in the main Products dropdown (Layout nav). */
export const NAV_TOOLS: readonly ToolDefinition[] = TOOLS.filter(t => !!t.nav?.dropdown);

/** Tools shown on the /products listing page. Omits tools that explicitly opt out. */
export const LISTING_TOOLS: readonly ToolDefinition[] = TOOLS.filter(t => t.nav?.listing !== false);

/** Tools that have a page component registered (routable). */
export type RoutableTool = ToolDefinition & { loader: ToolLoader };
export const ROUTABLE_TOOLS: readonly RoutableTool[] = TOOLS.filter(
  (t): t is RoutableTool => !!t.loader,
);

/** Fallback theme used when a tool's theme is missing (new tools pre-setup). */
export const DEFAULT_THEME: ToolTheme = TOOLS[0].theme;

/** Get theme for a tool slug, falling back to the default. */
export function getToolTheme(slug: string): ToolTheme {
  return BY_SLUG[slug]?.theme ?? DEFAULT_THEME;
}
