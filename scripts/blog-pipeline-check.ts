// Deterministic checker for the six-step blog content DAG
// (decompose → gather → outline → write → compose → illustrate).
// Validates the JSON artifacts each step leaves in the drafts folder and enforces
// word budgets that scale with the number of evidenced sections. No network/model calls.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { analyzeReadability } from './blog-readability.js';

export interface PipelineConfig {
  minQuestions: number;
  maxQuestions: number;
  requiredQuestionKinds: string[];
  minEvidencePerSection: number;
  community: { minUpvotes: number; minQuality: number };
  budget: {
    hookWords: number;
    sectionWords: number;
    closeWords: number;
    tolerance: number;
    blogMin: number;
    blogMax: number;
  };
  channels: { linkedin: { minWords: number; maxWords: number }; x: { maxChars: number } };
  toneMaxSections: Record<string, number>;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  minQuestions: 3,
  maxQuestions: 7,
  requiredQuestionKinds: ['value', 'who', 'start'],
  minEvidencePerSection: 2,
  community: { minUpvotes: 25, minQuality: 0.7 },
  budget: { hookWords: 50, sectionWords: 140, closeWords: 60, tolerance: 0.2, blogMin: 200, blogMax: 1000 },
  channels: { linkedin: { minWords: 120, maxWords: 250 }, x: { maxChars: 280 } },
  toneMaxSections: { changelog: 2, 'shipped-note': 3, 'problem-outcome': 3, 'field-note': 5, 'metric-update': 3 },
};

const QUESTION_KINDS = ['value', 'who', 'how-it-works', 'proof', 'next', 'start', 'other'];
const SOURCE_KINDS = ['diff', 'readme', 'live-app', 'scorecard', 'mcp', 'db', 'doc', 'community'];

export interface Question {
  id: string;
  question: string;
  kind: string;
}
export interface QuestionsArtifact {
  story_unit: string;
  questions: Question[];
}
export interface EvidenceItem {
  id: string;
  question_ids: string[];
  source_kind: string;
  source: string;
  claim: string;
  upvotes?: number;
  quality?: number;
}
export interface EvidenceArtifact {
  items: EvidenceItem[];
}
export interface OutlineSection {
  id: string;
  heading: string;
  point: string;
  evidence_ids: string[];
  figure?: string;
}
export interface OutlineArtifact {
  tone: string;
  title: string;
  hook: string;
  sections: OutlineSection[];
  next: string;
}
export interface PipelineArtifacts {
  questions: QuestionsArtifact;
  evidence: EvidenceArtifact;
  outline: OutlineArtifact;
  linkedin?: string;
  x?: string;
}

export interface BlogBudget {
  target: number;
  min: number;
  max: number;
}

export interface PipelineReport {
  pass: boolean;
  errors: string[];
  summary: {
    questionCount: number;
    evidenceCount: number;
    communityKept: number;
    sections: { heading: string; evidenceCount: number }[];
    budget: BlogBudget;
    postWords: number;
    linkedinWords: number;
    xChars: number;
  };
}

export function computeBlogBudget(sectionCount: number, cfg: PipelineConfig): BlogBudget {
  const b = cfg.budget;
  const target = b.hookWords + sectionCount * b.sectionWords + b.closeWords;
  return {
    target,
    min: Math.max(b.blogMin, Math.round(target * (1 - b.tolerance))),
    max: Math.min(b.blogMax, Math.round(target * (1 + b.tolerance))),
  };
}

function stripFrontmatter(md: string): string {
  const m = md.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  return m ? md.slice(m[0].length) : md;
}

function dupes(ids: string[]): string[] {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const id of ids) (seen.has(id) ? out : seen).add(id);
  return [...out];
}

export function checkPipeline(
  artifacts: PipelineArtifacts,
  postMarkdown: string,
  cfg: PipelineConfig = DEFAULT_PIPELINE_CONFIG,
): PipelineReport {
  const errors: string[] = [];
  const questions = artifacts.questions?.questions ?? [];
  const items = artifacts.evidence?.items ?? [];
  const outline = artifacts.outline;
  const sections = outline?.sections ?? [];

  // R1 questions
  if (questions.length < cfg.minQuestions || questions.length > cfg.maxQuestions) {
    errors.push(`R1: question count ${questions.length} outside [${cfg.minQuestions}, ${cfg.maxQuestions}]`);
  }
  for (const id of dupes(questions.map((q) => q.id))) errors.push(`R1: duplicate question id "${id}"`);
  for (const kind of cfg.requiredQuestionKinds) {
    if (!questions.some((q) => q.kind === kind)) errors.push(`R1: no question of required kind "${kind}"`);
  }
  for (const q of questions) {
    if (!QUESTION_KINDS.includes(q.kind)) errors.push(`R1: question "${q.id}" has unknown kind "${q.kind}"`);
  }
  const questionIds = new Set(questions.map((q) => q.id));

  // R2 evidence
  for (const id of dupes(items.map((e) => e.id))) errors.push(`R2: duplicate evidence id "${id}"`);
  let communityKept = 0;
  for (const e of items) {
    if (!Array.isArray(e.question_ids) || e.question_ids.length === 0) {
      errors.push(`R2: evidence "${e.id}" has no question_ids`);
    } else {
      for (const qid of e.question_ids) {
        if (!questionIds.has(qid)) errors.push(`R2: evidence "${e.id}" references unknown question "${qid}"`);
      }
    }
    if (!e.source?.trim()) errors.push(`R2: evidence "${e.id}" has empty source`);
    if (!e.claim?.trim()) errors.push(`R2: evidence "${e.id}" has empty claim`);
    if (!SOURCE_KINDS.includes(e.source_kind)) {
      errors.push(`R2: evidence "${e.id}" has unknown source_kind "${e.source_kind}"`);
    }
    if (e.source_kind === 'community') {
      if ((e.quality ?? 0) >= cfg.community.minQuality || (e.upvotes ?? 0) >= cfg.community.minUpvotes) {
        communityKept++;
      } else {
        errors.push(
          `R2: community evidence "${e.id}" is below both floors (quality < ${cfg.community.minQuality} and upvotes < ${cfg.community.minUpvotes}); drop it at gather time`,
        );
      }
    }
  }
  const evidenceById = new Map(items.map((e) => [e.id, e]));

  // R3 outline
  const maxSections = cfg.toneMaxSections[outline?.tone];
  if (maxSections === undefined) {
    errors.push(`R3: unknown tone "${outline?.tone}"`);
  } else if (sections.length < 1 || sections.length > maxSections) {
    errors.push(`R3: tone "${outline.tone}" allows 1-${maxSections} sections, outline has ${sections.length}`);
  }
  const citedEvidence = new Set<string>();
  for (const s of sections) {
    const ids = s.evidence_ids ?? [];
    if (ids.length < cfg.minEvidencePerSection) {
      errors.push(`R3: section "${s.id}" has ${ids.length} evidence ids, needs at least ${cfg.minEvidencePerSection}`);
    }
    for (const id of ids) {
      if (!evidenceById.has(id)) errors.push(`R3: section "${s.id}" cites unknown evidence "${id}"`);
      else citedEvidence.add(id);
    }
  }
  const coveredQuestions = new Set<string>();
  for (const id of citedEvidence) for (const qid of evidenceById.get(id)!.question_ids ?? []) coveredQuestions.add(qid);
  for (const q of questions) {
    if (cfg.requiredQuestionKinds.includes(q.kind) && !coveredQuestions.has(q.id)) {
      errors.push(`R3: required question "${q.id}" (${q.kind}) is not covered by evidence cited in any section`);
    }
  }

  // R4 post structure
  const body = stripFrontmatter(postMarkdown);
  const h2s = body
    .split(/\r?\n/)
    .filter((l) => l.startsWith('## '))
    .map((l) => l.slice(3).trim());
  let cursor = 0;
  for (const s of sections) {
    const at = h2s.indexOf(s.heading.trim(), cursor);
    if (at === -1) {
      errors.push(
        h2s.includes(s.heading.trim(), 0)
          ? `R4: section "${s.id}" heading "${s.heading}" is out of outline order in the post`
          : `R4: section "${s.id}" heading "${s.heading}" not found as an H2 in the post`,
      );
    } else {
      cursor = at + 1;
    }
  }

  // R5 post length
  const budget = computeBlogBudget(sections.length, cfg);
  const postWords = analyzeReadability(body).wordCount;
  if (postWords < budget.min || postWords > budget.max) {
    errors.push(`R5: post is ${postWords} words, budget for ${sections.length} sections is ${budget.min}-${budget.max}`);
  }

  // R6 renditions
  let linkedinWords = 0;
  if (artifacts.linkedin === undefined || !artifacts.linkedin.trim()) {
    errors.push('R6: LinkedIn rendition is missing');
  } else {
    linkedinWords = analyzeReadability(artifacts.linkedin).wordCount;
    const { minWords, maxWords } = cfg.channels.linkedin;
    if (linkedinWords < minWords || linkedinWords > maxWords) {
      errors.push(`R6: LinkedIn rendition is ${linkedinWords} words, must be ${minWords}-${maxWords}`);
    }
    if (!/https:\/\//.test(artifacts.linkedin)) errors.push('R6: LinkedIn rendition has no https:// URL');
  }
  let xChars = 0;
  if (artifacts.x === undefined || !artifacts.x.trim()) {
    errors.push('R6: X rendition is missing');
  } else {
    xChars = artifacts.x.trim().length;
    if (xChars > cfg.channels.x.maxChars) {
      errors.push(`R6: X rendition is ${xChars} characters, max is ${cfg.channels.x.maxChars}`);
    }
  }

  return {
    pass: errors.length === 0,
    errors,
    summary: {
      questionCount: questions.length,
      evidenceCount: items.length,
      communityKept,
      sections: sections.map((s) => ({ heading: s.heading, evidenceCount: (s.evidence_ids ?? []).length })),
      budget,
      postWords,
      linkedinWords,
      xChars,
    },
  };
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function loadPipelineConfigFromConfig(): PipelineConfig {
  const D = DEFAULT_PIPELINE_CONFIG;
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.join(scriptDir, '..', '.claude/skills/blog-from-git/blog.config.yaml');

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch {
    return D;
  }

  try {
    const doc = yaml.load(raw) as any;
    const p = doc?.pipeline;
    const toneMaxSections: Record<string, number> = { ...D.toneMaxSections };
    for (const [name, tone] of Object.entries(doc?.tones ?? {})) {
      const m = (tone as any)?.max_sections;
      if (typeof m === 'number' && Number.isFinite(m)) toneMaxSections[name] = m;
    }
    if (!p) return { ...D, toneMaxSections };
    const kinds = p.required_question_kinds;
    return {
      minQuestions: num(p.min_questions, D.minQuestions),
      maxQuestions: num(p.max_questions, D.maxQuestions),
      requiredQuestionKinds:
        Array.isArray(kinds) && kinds.every((k: unknown) => typeof k === 'string') ? kinds : D.requiredQuestionKinds,
      minEvidencePerSection: num(p.min_evidence_per_section, D.minEvidencePerSection),
      community: {
        minUpvotes: num(p.community?.min_upvotes, D.community.minUpvotes),
        minQuality: num(p.community?.min_quality, D.community.minQuality),
      },
      budget: {
        hookWords: num(p.budget?.hook_words, D.budget.hookWords),
        sectionWords: num(p.budget?.section_words, D.budget.sectionWords),
        closeWords: num(p.budget?.close_words, D.budget.closeWords),
        tolerance: num(p.budget?.tolerance, D.budget.tolerance),
        blogMin: num(p.budget?.blog_min_words, D.budget.blogMin),
        blogMax: num(p.budget?.blog_max_words, D.budget.blogMax),
      },
      channels: {
        linkedin: {
          minWords: num(p.channels?.linkedin?.min_words, D.channels.linkedin.minWords),
          maxWords: num(p.channels?.linkedin?.max_words, D.channels.linkedin.maxWords),
        },
        x: { maxChars: num(p.channels?.x?.max_chars, D.channels.x.maxChars) },
      },
      toneMaxSections,
    };
  } catch (err) {
    process.stderr.write(
      `blog-pipeline-check: failed to parse ${configPath}, using default pipeline config: ${(err as Error).message}\n`,
    );
    return D;
  }
}

function readJson<T>(file: string): T {
  let text: string;
  try {
    text = readFileSync(file, 'utf-8');
  } catch {
    throw new Error(`cannot read artifact file: ${file}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`cannot parse artifact file: ${file}`);
  }
}

function readOptionalText(file: string): string | undefined {
  try {
    return readFileSync(file, 'utf-8');
  } catch {
    return undefined;
  }
}

function main(): number {
  const [dir, postFile] = process.argv.slice(2);
  if (!dir || !postFile) {
    process.stderr.write('Usage: blog-pipeline-check.ts <artifact-dir> <post.md>\n');
    return 2;
  }

  let artifacts: PipelineArtifacts;
  let post: string;
  try {
    artifacts = {
      questions: readJson<QuestionsArtifact>(path.join(dir, 'questions.json')),
      evidence: readJson<EvidenceArtifact>(path.join(dir, 'evidence.json')),
      outline: readJson<OutlineArtifact>(path.join(dir, 'outline.json')),
      linkedin: readOptionalText(path.join(dir, 'renditions/linkedin.md')),
      x: readOptionalText(path.join(dir, 'renditions/x.md')),
    };
    try {
      post = readFileSync(postFile, 'utf-8');
    } catch {
      throw new Error(`cannot read post file: ${postFile}`);
    }
  } catch (err) {
    process.stderr.write(`blog-pipeline-check: ${(err as Error).message}\n`);
    return 2;
  }

  const report = checkPipeline(artifacts, post, loadPipelineConfigFromConfig());
  console.log(JSON.stringify(report, null, 2));
  return report.pass ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
