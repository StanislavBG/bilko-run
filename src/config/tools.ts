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
  {
    slug: 'page-roast',
    name: 'PageRoast',
    tagline: 'Brutally honest landing page audits',
    description: "Paste any URL. Get a scored CRO audit across 4 frameworks — hero, social proof, clarity, and conversion architecture. Plus a savage roast line you'll want to screenshot.",
    features: ['CRO scoring (0-100)', 'A/B Compare mode', 'Shareable results', 'Actionable fixes'],
    category: 'business',
    status: 'live',
    accent: { text: 'text-fire-500', bg: 'bg-fire-500', hoverBorder: 'hover:border-fire-300' },
    theme: {
      heroGradient: 'from-warm-900 via-warm-950 to-warm-900',
      glowColor: 'rgba(255,107,26,0.12)',
      accentText: 'text-fire-400',
      accentTextLight: 'text-fire-500',
      buttonBg: 'bg-fire-500',
      buttonHover: 'hover:bg-fire-600',
      buttonShadow: 'shadow-fire-900/30',
    },
    nav: {
      dropdown: { desc: 'Paste any URL. Get a scored landing page audit with actionable fixes in 30 seconds.' },
      home: { tag: 'Marketing', desc: 'Landing page CRO audit + savage roast' },
    },
    crossPromo: [
      { slug: 'headline-grader', hook: "Roasted your page? Now grade the headline that's selling it." },
      { slug: 'ad-scorer', hook: "Fixed your page? Score the ad that's driving traffic to it." },
    ],
    loader: () => import('../pages/PageRoastPage.js').then(m => ({ default: m.PageRoastPage })),
    productKey: PRODUCT_KEYS.PAGEROAST_TOKENS,
  },
  {
    slug: 'headline-grader',
    name: 'HeadlineGrader',
    tagline: 'Score headlines like a pro copywriter',
    description: 'AI grades your headlines against 4 proven frameworks — Rule of One, Hormozi Value Equation, Readability, and Proof+Promise+Plan. Get a score, a diagnosis, and AI rewrites.',
    features: ['Framework-based scoring', 'AI rewrites', 'SERP preview', 'A/B Compare'],
    category: 'content',
    status: 'live',
    accent: { text: 'text-indigo-500', bg: 'bg-indigo-500', hoverBorder: 'hover:border-indigo-300' },
    theme: {
      heroGradient: 'from-[#1a1530] via-[#0f0d1a] to-[#1a1530]',
      glowColor: 'rgba(99,102,241,0.14)',
      accentText: 'text-indigo-400',
      accentTextLight: 'text-indigo-500',
      buttonBg: 'bg-indigo-500',
      buttonHover: 'hover:bg-indigo-600',
      buttonShadow: 'shadow-indigo-900/30',
    },
    nav: { home: { tag: 'Marketing', desc: '4-framework headline scoring' } },
    crossPromo: [
      { slug: 'page-roast', hook: 'Great headline. Now roast the page it lives on.' },
      { slug: 'thread-grader', hook: 'Headlines are hooks. Test yours in a full thread.' },
    ],
    loader: () => import('../pages/HeadlineGraderPage.js').then(m => ({ default: m.HeadlineGraderPage })),
  },
  {
    slug: 'ad-scorer',
    name: 'AdScorer',
    tagline: 'Grade ads before you spend the budget',
    description: 'Platform-specific ad copy grading for Google, Meta, and LinkedIn. Scores hook strength, value prop, emotional architecture, and CTA conversion.',
    features: ['Platform-specific rules', 'Copy rewrites', 'A/B Compare', '4-pillar scoring'],
    category: 'content',
    status: 'live',
    accent: { text: 'text-emerald-500', bg: 'bg-emerald-500', hoverBorder: 'hover:border-emerald-300' },
    theme: {
      heroGradient: 'from-[#0d1f17] via-[#0a1510] to-[#0d1f17]',
      glowColor: 'rgba(16,185,129,0.14)',
      accentText: 'text-emerald-400',
      accentTextLight: 'text-emerald-500',
      buttonBg: 'bg-emerald-500',
      buttonHover: 'hover:bg-emerald-600',
      buttonShadow: 'shadow-emerald-900/30',
    },
    nav: { home: { tag: 'Marketing', desc: 'Platform-specific ad grading' } },
    crossPromo: [
      { slug: 'page-roast', hook: 'Ad scored. Now roast the landing page it sends people to.' },
      { slug: 'email-forge', hook: 'Ads drive clicks. Emails close deals. Generate your sequence.' },
    ],
    loader: () => import('../pages/AdScorerPage.js').then(m => ({ default: m.AdScorerPage })),
  },
  {
    slug: 'thread-grader',
    name: 'ThreadGrader',
    tagline: 'Score your X/Twitter threads',
    description: 'AI scores hook strength, tension chain, payoff quality, and share triggers. Plus tweet-by-tweet breakdown and hook rewrites.',
    features: ['Hook analysis', 'Tweet breakdown', 'Hook rewrites', 'A/B Compare'],
    category: 'content',
    status: 'live',
    accent: { text: 'text-sky-500', bg: 'bg-sky-500', hoverBorder: 'hover:border-sky-300' },
    theme: {
      heroGradient: 'from-[#0c1929] via-[#080f1a] to-[#0c1929]',
      glowColor: 'rgba(14,165,233,0.14)',
      accentText: 'text-sky-400',
      accentTextLight: 'text-sky-500',
      buttonBg: 'bg-sky-500',
      buttonHover: 'hover:bg-sky-600',
      buttonShadow: 'shadow-sky-900/30',
    },
    nav: { home: { tag: 'Marketing', desc: 'X/Twitter thread viral analysis' } },
    crossPromo: [
      { slug: 'headline-grader', hook: 'Thread hooks are headlines. Score them in isolation.' },
      { slug: 'audience-decoder', hook: "Know who's reading your threads. Decode your audience." },
    ],
    loader: () => import('../pages/ThreadGraderPage.js').then(m => ({ default: m.ThreadGraderPage })),
  },
  {
    slug: 'email-forge',
    name: 'EmailForge',
    tagline: 'Generate email sequences that convert',
    description: 'AI creates 5-email sequences using AIDA, PAS, Hormozi, Cialdini, and Storytelling frameworks. Cold outreach, nurture, launch, or re-engagement.',
    features: ['5-email sequences', '5 frameworks', 'Open/click estimates', 'A/B Compare'],
    category: 'content',
    status: 'live',
    accent: { text: 'text-amber-500', bg: 'bg-amber-500', hoverBorder: 'hover:border-amber-300' },
    theme: {
      heroGradient: 'from-[#1f1a0d] via-[#15100a] to-[#1f1a0d]',
      glowColor: 'rgba(245,158,11,0.14)',
      accentText: 'text-amber-400',
      accentTextLight: 'text-amber-500',
      buttonBg: 'bg-amber-500',
      buttonHover: 'hover:bg-amber-600',
      buttonShadow: 'shadow-amber-900/30',
    },
    nav: { home: { tag: 'Marketing', desc: '5-email sequence generator' } },
    crossPromo: [
      { slug: 'ad-scorer', hook: 'Emails done. Now score the ad that fills the top of funnel.' },
      { slug: 'audience-decoder', hook: "Know who you're emailing. Decode your audience first." },
    ],
    loader: () => import('../pages/EmailForgePage.js').then(m => ({ default: m.EmailForgePage })),
  },
  {
    slug: 'audience-decoder',
    name: 'AudienceDecoder',
    tagline: 'Decode who actually follows you',
    description: 'Paste your social content. AI identifies audience archetypes, content patterns, engagement model, growth opportunities, and builds a content calendar.',
    features: ['Audience archetypes', 'Engagement scoring', 'Growth opportunities', 'Content calendar'],
    category: 'content',
    status: 'live',
    accent: { text: 'text-purple-500', bg: 'bg-purple-500', hoverBorder: 'hover:border-purple-300' },
    theme: {
      heroGradient: 'from-[#1a0f2e] via-[#120a1f] to-[#1a0f2e]',
      glowColor: 'rgba(168,85,247,0.14)',
      accentText: 'text-purple-400',
      accentTextLight: 'text-purple-500',
      buttonBg: 'bg-purple-500',
      buttonHover: 'hover:bg-purple-600',
      buttonShadow: 'shadow-purple-900/30',
    },
    nav: { home: { tag: 'Marketing', desc: 'Audience archetype + engagement' } },
    crossPromo: [
      { slug: 'thread-grader', hook: "Know your audience. Now write threads they'll actually share." },
      { slug: 'email-forge', hook: "Know your people. Now write emails they'll actually open." },
    ],
    loader: () => import('../pages/AudienceDecoderPage.js').then(m => ({ default: m.AudienceDecoderPage })),
    productKey: PRODUCT_KEYS.AUDIENCEDECODER_REPORT,
  },
  {
    slug: 'launch-grader',
    name: 'LaunchGrader',
    tagline: 'Is your product ready to launch?',
    description: 'AI audits your go-to-market readiness across 5 dimensions: value prop, pricing, social proof, onboarding, and competitive positioning. Get a score, blockers, and a verdict.',
    features: ['5-dimension audit', 'Launch blockers', 'Readiness verdict', 'Competitor comparison'],
    category: 'business',
    status: 'live',
    accent: { text: 'text-teal-500', bg: 'bg-teal-500', hoverBorder: 'hover:border-teal-300' },
    theme: {
      heroGradient: 'from-[#0d1f1d] via-[#0a1513] to-[#0d1f1d]',
      glowColor: 'rgba(20,184,166,0.14)',
      accentText: 'text-teal-400',
      accentTextLight: 'text-teal-500',
      buttonBg: 'bg-teal-500',
      buttonHover: 'hover:bg-teal-600',
      buttonShadow: 'shadow-teal-900/30',
    },
    nav: {
      dropdown: { desc: 'Is your product ready to launch? AI audits your go-to-market across 5 dimensions.' },
      home: { tag: 'Marketing', desc: 'Go-to-market readiness audit' },
    },
    crossPromo: [
      { slug: 'page-roast', hook: 'Launch readiness checked. Now roast the landing page that sells it.' },
      { slug: 'stack-audit', hook: "Ready to launch? Make sure your stack isn't bleeding money first." },
    ],
    loader: () => import('../pages/LaunchGraderPage.js').then(m => ({ default: m.LaunchGraderPage })),
  },
  {
    slug: 'stack-audit',
    name: 'StackAudit',
    tagline: 'Find waste in your SaaS stack',
    description: 'Paste your tool list. AI finds overlap, cheaper alternatives, self-hosted options, and calculates exactly how much you can save. Enterprise audit for $1.',
    features: ['Cost analysis', 'Overlap detection', 'Alternative suggestions', 'Savings calculator'],
    category: 'business',
    status: 'live',
    accent: { text: 'text-slate-600', bg: 'bg-slate-500', hoverBorder: 'hover:border-slate-300' },
    theme: {
      heroGradient: 'from-[#151a20] via-[#0f1318] to-[#151a20]',
      glowColor: 'rgba(100,116,139,0.14)',
      accentText: 'text-slate-400',
      accentTextLight: 'text-slate-500',
      buttonBg: 'bg-slate-600',
      buttonHover: 'hover:bg-slate-700',
      buttonShadow: 'shadow-slate-900/30',
    },
    nav: {
      dropdown: { desc: 'Find overlap and waste in your SaaS subscriptions. See exactly how much you can save.' },
      home: { tag: 'Ops', desc: 'SaaS tool stack cost + waste finder' },
    },
    crossPromo: [
      { slug: 'launch-grader', hook: 'Stack optimized. Now audit your launch readiness.' },
      { slug: 'local-score', hook: 'Need to analyze sensitive contracts? Do it privately in your browser.' },
    ],
    loader: () => import('../pages/StackAuditPage.js').then(m => ({ default: m.StackAuditPage })),
  },
  {
    slug: 'local-score',
    name: 'LocalScore',
    tagline: 'Private document analysis — runs in your browser',
    description: 'FREE — Analyze contracts, financials, meeting notes, and sensitive documents with AI that runs entirely in your browser. Your data never leaves your device. Zero cost, zero servers, zero risk.',
    features: ['100% local', 'Zero API costs', 'Works offline', 'GDPR-friendly'],
    category: 'business',
    status: 'live',
    accent: { text: 'text-green-500', bg: 'bg-green-500', hoverBorder: 'hover:border-green-300' },
    theme: {
      heroGradient: 'from-[#0d1f12] via-[#0a150d] to-[#0d1f12]',
      glowColor: 'rgba(34,197,94,0.14)',
      accentText: 'text-green-400',
      accentTextLight: 'text-green-500',
      buttonBg: 'bg-green-500',
      buttonHover: 'hover:bg-green-600',
      buttonShadow: 'shadow-green-900/30',
    },
    nav: {
      dropdown: { badge: 'Free', desc: 'Analyze sensitive documents with AI that runs entirely in your browser. Nothing leaves your device.' },
      home: { tag: 'Free', desc: 'Private doc analysis via WebGPU', free: true },
    },
    crossPromo: [
      { slug: 'stack-audit', hook: 'Analyzed your docs. Now find waste in your SaaS stack.' },
      { slug: 'page-roast', hook: 'Documents done. Now roast your landing page.' },
    ],
    loader: () => import('../pages/LocalScorePage.js').then(m => ({ default: m.LocalScorePage })),
  },
  {
    slug: 'stepproof',
    name: 'Stepproof',
    tagline: 'Regression tests for AI pipelines',
    description: 'Write YAML scenarios, run them N times, check if your LLM can follow instructions. Preset scenarios or bring your own. Like unit tests, but for AI.',
    features: ['YAML scenarios', 'Preset library', 'LLM judge assertions', 'BYOK support'],
    category: 'devtools',
    status: 'live',
    accent: { text: 'text-cyan-500', bg: 'bg-cyan-500', hoverBorder: 'hover:border-cyan-300' },
    theme: {
      heroGradient: 'from-[#0d1c1f] via-[#0a1315] to-[#0d1c1f]',
      glowColor: 'rgba(6,182,212,0.14)',
      accentText: 'text-cyan-400',
      accentTextLight: 'text-cyan-500',
      buttonBg: 'bg-cyan-500',
      buttonHover: 'hover:bg-cyan-600',
      buttonShadow: 'shadow-cyan-900/30',
    },
    nav: { home: { tag: 'Dev', desc: 'YAML scenario tests for AI pipelines' } },
    crossPromo: [
      { slug: 'page-roast', hook: 'Tests passing? Celebrate by roasting your landing page.' },
      { slug: 'headline-grader', hook: 'Pipeline works. Now make sure the headline selling it works too.' },
    ],
    loader: () => import('../pages/StepproofPage.js').then(m => ({ default: m.StepproofPage })),
  },
  {
    slug: 'outdoor-hours',
    name: 'OutdoorHours',
    tagline: 'KOUT-7: ten years of comfortable hours, scored',
    description: 'Where is the weather actually better — Bay Area or Seattle Eastside? We counted every hour of the last ten years and asked one question: was it comfortable to be outside? Daytime, comfortable temp (45-86°F), safe UV, not pouring. Click any dot to drill in.',
    features: ['10 yrs of hourly ERA5 data', 'Year/month/day rollups', 'Click-to-drill detail', 'KOUT-7 broadcast UI'],
    category: 'business',
    status: 'live',
    accent: { text: 'text-[#e45c3a]', bg: 'bg-[#e45c3a]', hoverBorder: 'hover:border-[#f2b046]' },
    theme: {
      heroGradient: 'from-[#1a0d08] via-[#120907] to-[#0d1f1d]',
      glowColor: 'rgba(228,92,58,0.14)',
      accentText: 'text-[#f2b046]',
      accentTextLight: 'text-[#e45c3a]',
      buttonBg: 'bg-[#e45c3a]',
      buttonHover: 'hover:bg-[#c44a2a]',
      buttonShadow: 'shadow-orange-900/30',
    },
    nav: {
      dropdown: { desc: 'KOUT-7 weather report: 10 years of comfortable outdoor hours, Bay Area vs. Seattle Eastside.' },
      home: { tag: 'Free', desc: '10 yrs of weather, scored for outdoors', free: true },
    },
    crossPromo: [
      { slug: 'local-score', hook: 'Like data that runs in your browser? Try LocalScore for private documents.' },
      { slug: 'page-roast', hook: 'Built a microsite from your data? Now roast its landing page.' },
    ],
    loader: () => import('../pages/OutdoorHoursPage.js').then(m => ({ default: m.OutdoorHoursPage })),
  },
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
