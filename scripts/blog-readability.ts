// Deterministic, dependency-light readability checker for bilko.run blog drafts.
// Scores prose against the US Federal Plain Language Guidelines target (~8th-grade
// reading level) using the Flesch-Kincaid grade formula, no network/model calls.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

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
}

export interface LinkIssue {
  kind: 'relative-link' | 'unlinked-source-claim';
  text: string;
}

export interface ReadabilityReport {
  fkGrade: number;
  avgSentenceWords: number;
  longSentences: string[];
  jargonHits: JargonPair[];
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
};

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

export function analyzeReadability(
  markdown: string,
  opts: Partial<ReadabilityThresholds> = {},
): ReadabilityReport {
  const thresholds: ReadabilityThresholds = {
    maxFkGrade: opts.maxFkGrade ?? DEFAULT_THRESHOLDS.maxFkGrade,
    maxAvgSentenceWords: opts.maxAvgSentenceWords ?? DEFAULT_THRESHOLDS.maxAvgSentenceWords,
    longSentenceWords: opts.longSentenceWords ?? DEFAULT_THRESHOLDS.longSentenceWords,
    maxLongSentences: opts.maxLongSentences ?? DEFAULT_THRESHOLDS.maxLongSentences,
    jargonBlocklist: opts.jargonBlocklist ?? DEFAULT_THRESHOLDS.jargonBlocklist,
  };

  const linkIssues = findLinkIssues(markdown);
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

  const pass =
    fkGrade <= thresholds.maxFkGrade &&
    avgSentenceWords <= thresholds.maxAvgSentenceWords &&
    longSentences.length <= thresholds.maxLongSentences &&
    jargonHits.length === 0 &&
    linkIssues.length === 0;

  return { fkGrade, avgSentenceWords, longSentences, jargonHits, linkIssues, wordCount, pass };
}

function isJargonBlocklist(value: unknown): value is JargonPair[] {
  return (
    Array.isArray(value) &&
    value.every((v) => v && typeof v === 'object' && typeof (v as any).term === 'string')
  );
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
    return {
      maxFkGrade: r.max_fk_grade ?? DEFAULT_THRESHOLDS.maxFkGrade,
      maxAvgSentenceWords: r.max_avg_sentence_words ?? DEFAULT_THRESHOLDS.maxAvgSentenceWords,
      longSentenceWords: r.long_sentence_words ?? DEFAULT_THRESHOLDS.longSentenceWords,
      maxLongSentences: r.max_long_sentences ?? DEFAULT_THRESHOLDS.maxLongSentences,
      jargonBlocklist,
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

function main(): void {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write('Usage: blog-readability.ts <file.md>\n');
    process.exit(2);
  }

  let markdown: string;
  try {
    markdown = readFileSync(file, 'utf-8');
  } catch {
    process.stderr.write(`blog-readability: cannot read file: ${file}\n`);
    process.exit(2);
  }

  const thresholds = loadThresholdsFromConfig();
  const report = analyzeReadability(markdown, thresholds);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
