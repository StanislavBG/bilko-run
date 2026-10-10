// Deterministic, dependency-light readability checker for bilko.run blog drafts.
// Scores prose against the US Federal Plain Language Guidelines target (~8th-grade
// reading level) using the Flesch-Kincaid grade formula, no network/model calls.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { parseFigure } from '../src/lib/blogMarkdown.js';

export interface JargonPair {
  term: string;
  suggestion: string;
}

export interface ReadabilityThresholds {
  maxFkGrade: number;
  maxAvgSentenceWords: number;
  longSentenceWords: number;
  maxLongSentences: number;
  jargonBlocklist: JargonPair[];
  marketingBlocklist: string[];
}

export interface LinkIssue {
  kind: 'relative-link' | 'unlinked-source-claim' | 'unknown-project-link';
  text: string;
}

export interface ProjectRegistryEntry {
  slug: string;
  host: {
    kind: string;
    path?: string;
  };
}

export interface ReadabilityReport {
  fkGrade: number;
  avgSentenceWords: number;
  longSentences: string[];
  jargonHits: JargonPair[];
  marketingHits: string[];
  linkIssues: LinkIssue[];
  wordCount: number;
  pass: boolean;
}

export const DEFAULT_THRESHOLDS: ReadabilityThresholds = {
  maxFkGrade: 8,
  maxAvgSentenceWords: 18,
  longSentenceWords: 25,
  maxLongSentences: 2,
  jargonBlocklist: [
    { term: 'leverage', suggestion: 'use' },
    { term: 'utilize', suggestion: 'use' },
    { term: 'robust', suggestion: 'strong' },
    { term: 'seamless', suggestion: 'smooth' },
    { term: 'orchestrate', suggestion: 'run' },
    { term: 'idempotent', suggestion: 'safe to repeat' },
    { term: 'latency', suggestion: 'delay' },
    { term: 'deprecate', suggestion: 'retire' },
    { term: 'facilitate', suggestion: 'help' },
    { term: 'synergy', suggestion: 'teamwork' },
    { term: 'paradigm', suggestion: 'model' },
    { term: 'bandwidth', suggestion: 'time' },
    { term: 'holistic', suggestion: 'complete' },
    { term: 'streamline', suggestion: 'simplify' },
    { term: 'actionable', suggestion: 'useful' },
    { term: 'scalable', suggestion: 'able to grow' },
    { term: 'optimize', suggestion: 'improve' },
    { term: 'mitigate', suggestion: 'reduce' },
  ],
  marketingBlocklist: ['sign up now', "don't miss", 'game-changer'],
};

// Figure blocks render as images, not prose or links, so drop them before any check.
// Uses the renderer's own parseFigure so readability and the post page agree.
export function stripFigures(body: string): string {
  return body
    .split(/\n\s*\n/)
    .filter((block) => parseFigure(block.trim()) === null)
    .join('\n\n');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripNonProse(markdown: string): string {
  let text = markdown;
  text = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''); // YAML front matter
  text = text.replace(/```[\s\S]*?```/g, ''); // fenced code blocks
  text = text.replace(/`[^`\n]*`/g, ''); // inline code
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // markdown links: keep text, drop target
  text = text.replace(/<[^>]+>/g, ''); // HTML tags (before bare-URL strip, so a URL inside
  // an href attribute is removed with its tag rather than bleeding into the link text)
  text = text.replace(/https?:\/\/\S+/g, ''); // bare URLs
  text = text.replace(/^#{1,6}\s+.*$/gm, ''); // whole heading lines (not prose, don't score them)
  return text;
}

function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.match(/[^.!?]+[.!?]+["')\]]*(?=\s|$)|[^.!?]+$/g) || [];
    for (const part of parts) {
      const s = part.trim();
      if (s) sentences.push(s);
    }
  }
  return sentences;
}

function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((t) => /[a-zA-Z]/.test(t));
}

// Heuristic syllable counter (no dictionary): count vowel-letter groups, then
// drop a trailing silent "e" unless it's a consonant+"le" ending (e.g. "table",
// "bubble") where the "e" already lands in its own vowel group. Approximate by
// design — good enough to estimate an FK grade, not meant to be exact.
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  let core = w;
  const endsInConsonantLe = /[^aeiouy]le$/.test(core);
  if (core.endsWith('e') && !endsInConsonantLe && core.length > 2) {
    core = core.slice(0, -1);
  }
  const groups = core.match(/[aeiouy]+/g) || [];
  return Math.max(1, groups.length);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const SOURCE_CLAIM_RE = /open[\s-]source|source code|on github|fork it/i;
const GITHUB_LINK_RE = /https:\/\/github\.com\//i;
const BARE_PROJECTS_PATH_RE = /(?<![A-Za-z0-9_./])\/projects\/[^\s)]*/g;
const MARKDOWN_LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

// Runs on the raw markdown (before stripNonProse removes link targets) so link
// destinations are still visible to check.
export function findLinkIssues(markdown: string): LinkIssue[] {
  const issues: LinkIssue[] = [];

  let remainder = '';
  let lastIndex = 0;
  for (const match of markdown.matchAll(MARKDOWN_LINK_RE)) {
    const target = match[1];
    const isAbsolute = /^https?:\/\//i.test(target) || /^mailto:/i.test(target);
    if (!isAbsolute) {
      issues.push({ kind: 'relative-link', text: match[0] });
    }
    remainder += markdown.slice(lastIndex, match.index);
    lastIndex = (match.index ?? 0) + match[0].length;
  }
  remainder += markdown.slice(lastIndex);

  for (const match of remainder.matchAll(BARE_PROJECTS_PATH_RE)) {
    issues.push({ kind: 'relative-link', text: match[0] });
  }

  if (!GITHUB_LINK_RE.test(markdown)) {
    const paragraphs = markdown.split(/\n\s*\n/);
    const claimingParagraph = paragraphs.find((paragraph) => SOURCE_CLAIM_RE.test(paragraph));
    if (claimingParagraph) {
      issues.push({ kind: 'unlinked-source-claim', text: claimingParagraph.trim() });
    }
  }

  return issues;
}

const PROJECT_LINK_RE = /https:\/\/bilko\.run\/(projects|products)\/([a-z0-9-]+)(\/)?/gi;

// Each registered project has exactly one valid link form for its host kind:
// static-path needs /projects/<slug>/ (trailing slash), react-route needs
// /products/<slug> (no trailing slash). Any other host kind has no valid
// bilko.run/projects or bilko.run/products form at all.
function expectedLinkForm(entry: ProjectRegistryEntry): { section: string; trailingSlash: boolean } | null {
  if (entry.host.kind === 'static-path') return { section: 'projects', trailingSlash: true };
  if (entry.host.kind === 'react-route') return { section: 'products', trailingSlash: false };
  return null;
}

// Runs on the raw markdown so link destinations are still visible (same
// reason findLinkIssues does), checked against a registry the caller supplies.
export function findProjectLinkIssues(markdown: string, registry: ProjectRegistryEntry[]): LinkIssue[] {
  const issues: LinkIssue[] = [];

  for (const match of markdown.matchAll(PROJECT_LINK_RE)) {
    const [text, section, slug, trailingSlash] = match;
    const entry = registry.find((e) => e.slug === slug);
    if (!entry) {
      issues.push({ kind: 'unknown-project-link', text });
      continue;
    }
    const expected = expectedLinkForm(entry);
    const matches =
      expected !== null && section.toLowerCase() === expected.section && Boolean(trailingSlash) === expected.trailingSlash;
    if (!matches) {
      issues.push({ kind: 'unknown-project-link', text });
    }
  }

  return issues;
}

export interface LiveLinkFailure {
  url: string;
  status: number | 'error';
}

const BARE_HTTPS_LINK_RE = /https:\/\/[^\s)<>"]+/g;

// Collects every absolute https link a reader could click: markdown link
// targets plus bare URLs in prose. Used by --check-live, separate from
// findLinkIssues (which flags relative/malformed links, not liveness).
export function collectHttpsLinks(markdown: string): string[] {
  const urls = new Set<string>();
  for (const match of markdown.matchAll(MARKDOWN_LINK_RE)) {
    if (/^https:\/\//i.test(match[1])) urls.add(match[1]);
  }
  for (const match of markdown.matchAll(BARE_HTTPS_LINK_RE)) {
    urls.add(match[0]);
  }
  return [...urls];
}

export async function checkLiveLinks(
  urls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<LiveLinkFailure[]> {
  const uniqueUrls = [...new Set(urls)];
  const failures: LiveLinkFailure[] = [];

  if (uniqueUrls.length > 20) {
    return [{ url: 'too many links', status: 'error' }];
  }

  for (const url of uniqueUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
      if (res.status < 200 || res.status > 399) {
        failures.push({ url, status: res.status });
      }
    } catch {
      failures.push({ url, status: 'error' });
    } finally {
      clearTimeout(timeout);
    }
  }

  return failures;
}

export function analyzeReadability(
  rawMarkdown: string,
  opts: Partial<ReadabilityThresholds> = {},
  projectRegistry?: ProjectRegistryEntry[],
): ReadabilityReport {
  const thresholds: ReadabilityThresholds = {
    maxFkGrade: opts.maxFkGrade ?? DEFAULT_THRESHOLDS.maxFkGrade,
    maxAvgSentenceWords: opts.maxAvgSentenceWords ?? DEFAULT_THRESHOLDS.maxAvgSentenceWords,
    longSentenceWords: opts.longSentenceWords ?? DEFAULT_THRESHOLDS.longSentenceWords,
    maxLongSentences: opts.maxLongSentences ?? DEFAULT_THRESHOLDS.maxLongSentences,
    jargonBlocklist: opts.jargonBlocklist ?? DEFAULT_THRESHOLDS.jargonBlocklist,
    marketingBlocklist: opts.marketingBlocklist ?? DEFAULT_THRESHOLDS.marketingBlocklist,
  };

  const markdown = stripFigures(rawMarkdown);
  const linkIssues = [
    ...findLinkIssues(markdown),
    ...(projectRegistry ? findProjectLinkIssues(markdown, projectRegistry) : []),
  ];
  const prose = stripNonProse(markdown);
  const sentences = splitSentences(prose);
  const allWords = wordsOf(prose);
  const wordCount = allWords.length;
  const sentenceCount = sentences.length;
  const syllableCount = allWords.reduce((sum, w) => sum + countSyllables(w), 0);

  const avgSentenceWords = wordCount > 0 && sentenceCount > 0 ? round1(wordCount / sentenceCount) : 0;
  const fkGrade =
    wordCount > 0 && sentenceCount > 0
      ? round1(0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59)
      : 0;

  const longSentences = sentences.filter((s) => wordsOf(s).length > thresholds.longSentenceWords);

  const jargonHits = thresholds.jargonBlocklist.filter(({ term }) => {
    const re = new RegExp(`\\b${escapeRegExp(term)}\\w*\\b`, 'i');
    return re.test(prose);
  });

  const marketingHits = thresholds.marketingBlocklist.filter((phrase) => {
    const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i');
    return re.test(prose);
  });

  const pass =
    fkGrade <= thresholds.maxFkGrade &&
    avgSentenceWords <= thresholds.maxAvgSentenceWords &&
    longSentences.length <= thresholds.maxLongSentences &&
    jargonHits.length === 0 &&
    marketingHits.length === 0 &&
    linkIssues.length === 0;

  return { fkGrade, avgSentenceWords, longSentences, jargonHits, marketingHits, linkIssues, wordCount, pass };
}

function isJargonBlocklist(value: unknown): value is JargonPair[] {
  return (
    Array.isArray(value) &&
    value.every((v) => v && typeof v === 'object' && typeof (v as any).term === 'string')
  );
}

function isMarketingBlocklist(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function loadProjectRegistry(): ProjectRegistryEntry[] {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const registryPath = path.join(scriptDir, '..', 'src/data/standalone-projects.json');
  try {
    const raw = readFileSync(registryPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadThresholdsFromConfig(): ReadabilityThresholds {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.join(scriptDir, '..', '.claude/skills/blog-from-git/blog.config.yaml');

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch {
    // No config file at all is the normal case for most checkouts — fall back quietly.
    return DEFAULT_THRESHOLDS;
  }

  try {
    const doc = yaml.load(raw) as any;
    const r = doc?.readability;
    if (!r) return DEFAULT_THRESHOLDS;
    const jargonBlocklist = isJargonBlocklist(r.jargon_blocklist)
      ? r.jargon_blocklist
      : DEFAULT_THRESHOLDS.jargonBlocklist;
    const marketingBlocklist = isMarketingBlocklist(doc?.distribution?.marketing_blocklist)
      ? doc.distribution.marketing_blocklist
      : DEFAULT_THRESHOLDS.marketingBlocklist;
    return {
      maxFkGrade: r.max_fk_grade ?? DEFAULT_THRESHOLDS.maxFkGrade,
      maxAvgSentenceWords: r.max_avg_sentence_words ?? DEFAULT_THRESHOLDS.maxAvgSentenceWords,
      longSentenceWords: r.long_sentence_words ?? DEFAULT_THRESHOLDS.longSentenceWords,
      maxLongSentences: r.max_long_sentences ?? DEFAULT_THRESHOLDS.maxLongSentences,
      jargonBlocklist,
      marketingBlocklist,
    };
  } catch (err) {
    // The file exists but failed to parse — that's a real mistake in a config someone just
    // edited, so say so instead of silently pretending the override took effect.
    process.stderr.write(
      `blog-readability: failed to parse ${configPath}, using default thresholds: ${(err as Error).message}\n`,
    );
    return DEFAULT_THRESHOLDS;
  }
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const checkLive = args.includes('--check-live');
  const file = args.find((a) => a !== '--check-live');
  if (!file) {
    process.stderr.write('Usage: blog-readability.ts <file.md> [--check-live]\n');
    return 2;
  }

  let markdown: string;
  try {
    markdown = readFileSync(file, 'utf-8');
  } catch {
    process.stderr.write(`blog-readability: cannot read file: ${file}\n`);
    return 2;
  }

  const thresholds = loadThresholdsFromConfig();
  const projectRegistry = loadProjectRegistry();
  const report = analyzeReadability(markdown, thresholds, projectRegistry);
  console.log(JSON.stringify(report, null, 2));

  if (!checkLive) {
    return report.pass ? 0 : 1;
  }

  const liveFailures = await checkLiveLinks(collectHttpsLinks(stripFigures(markdown)));
  if (liveFailures.length > 0) {
    process.stderr.write('blog-readability: live link check failed:\n');
    for (const failure of liveFailures) {
      process.stderr.write(`  ${failure.url} -> ${failure.status}\n`);
    }
  }

  return report.pass && liveFailures.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}
