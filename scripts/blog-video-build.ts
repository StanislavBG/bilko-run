// Blog Video builder: the agent authors a storyboard JSON; this file enforces story + grounding
// rules, inlines captured assets and narration, renders via blog-video-runtime and validates.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkClaimsGrounded, validateBlogVideoHtml } from './blog-video.js';
import { renderVideoHtml, type Rect, type ResolvedScene, type SceneType } from './blog-video-runtime.js';

export type StoryboardScene = {
  id: string;
  type: SceneType;
  duration: number;
  caption: string;
  callout?: string;
  source: string;
  asset?: string;
  focus?: Rect;
  narrationSeconds?: number;
};

export type Storyboard = {
  slug: string;
  voice: string;
  project: { name: string; url: string };
  scenes: StoryboardScene[];
};

const TOTAL_S = 30;
const MIN_SCENE_S = 3;
const MAX_SCENE_S = 8;
const MAX_CAPTION_WORDS = 12;
const MAX_CALLOUT_WORDS = 7;
const MIN_SCREENS = 3;
const W = 1280;
const H = 720;
const TYPES: SceneType[] = ['title', 'text', 'screen', 'closing'];
const PROJECT_URL_RE = /^(https:\/\/bilko\.run\/projects\/[a-z0-9-]+\/|https:\/\/github\.com\/\S+)$/;

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const nonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0;

export function parseStoryboard(json: unknown): Storyboard {
  const errors: string[] = [];
  const sb = (json ?? {}) as Record<string, any>;
  if (!nonEmpty(sb.slug)) errors.push('slug must be a non-empty string');
  if (!nonEmpty(sb.voice)) errors.push('voice must be a non-empty string');
  if (!nonEmpty(sb.project?.name)) errors.push('project.name must be a non-empty string');
  if (typeof sb.project?.url !== 'string' || !PROJECT_URL_RE.test(sb.project.url)) {
    errors.push('project.url must be https://bilko.run/projects/<slug>/ or https://github.com/...');
  }
  if (!Array.isArray(sb.scenes) || sb.scenes.length === 0) {
    errors.push('scenes must be a non-empty array');
    throw new Error(`invalid storyboard:\n- ${errors.join('\n- ')}`);
  }
  const scenes = sb.scenes as Array<Record<string, any>>;
  scenes.forEach((s, i) => {
    const id = nonEmpty(s?.id) ? s.id : `#${i}`;
    if (!nonEmpty(s?.id)) errors.push(`scene ${id}: id must be a non-empty string`);
    if (!TYPES.includes(s?.type)) errors.push(`scene ${id}: type must be one of ${TYPES.join('|')}`);
    if (!isNum(s?.duration)) {
      errors.push(`scene ${id}: duration must be a number`);
    } else if (s.duration < MIN_SCENE_S || s.duration > MAX_SCENE_S) {
      errors.push(`scene ${id}: duration must be between ${MIN_SCENE_S} and ${MAX_SCENE_S}, got ${s.duration}`);
    }
    if (!nonEmpty(s?.caption)) errors.push(`scene ${id}: caption must be a non-empty string`);
    else if (words(s.caption) > MAX_CAPTION_WORDS) {
      errors.push(`scene ${id}: caption has ${words(s.caption)} words, max ${MAX_CAPTION_WORDS}`);
    }
    if (s?.callout !== undefined) {
      if (typeof s.callout !== 'string') errors.push(`scene ${id}: callout must be a string`);
      else if (words(s.callout) > MAX_CALLOUT_WORDS) {
        errors.push(`scene ${id}: callout has ${words(s.callout)} words, max ${MAX_CALLOUT_WORDS}`);
      }
    }
    if (!nonEmpty(s?.source)) errors.push(`scene ${id}: source must be a non-empty post sentence`);
    if (s?.type === 'screen') {
      if (!nonEmpty(s.asset)) errors.push(`scene ${id}: screen scene requires an asset`);
      if (!s.focus) errors.push(`scene ${id}: screen scene requires a focus rect`);
    }
    if (s?.focus !== undefined) {
      const f = s.focus;
      const ok =
        isNum(f?.x) && isNum(f?.y) && isNum(f?.w) && isNum(f?.h) &&
        f.w > 0 && f.h > 0 && f.x >= 0 && f.y >= 0 && f.x + f.w <= W && f.y + f.h <= H;
      if (!ok) errors.push(`scene ${id}: focus must be a rect inside ${W}x${H}`);
    }
    if (s?.narrationSeconds !== undefined) {
      if (!isNum(s.narrationSeconds)) errors.push(`scene ${id}: narrationSeconds must be a number`);
      else if (isNum(s.duration) && s.narrationSeconds > s.duration - 0.3) {
        errors.push(`scene ${id}: narrationSeconds ${s.narrationSeconds} must be <= duration - 0.3 (${s.duration - 0.3})`);
      }
    }
  });
  const total = scenes.reduce((a, s) => a + (isNum(s?.duration) ? s.duration : 0), 0);
  if (Math.abs(total - TOTAL_S) > 0.01) errors.push(`scene durations must sum to ${TOTAL_S}, got ${total}`);
  if (scenes[0]?.type !== 'title') errors.push('first scene must be type title');
  if (scenes[scenes.length - 1]?.type !== 'closing') errors.push('last scene must be type closing');
  const screens = scenes.filter((s) => s?.type === 'screen').length;
  if (screens < MIN_SCREENS) errors.push(`storyboard needs at least ${MIN_SCREENS} screen scenes, got ${screens}`);
  if (errors.length) throw new Error(`invalid storyboard:\n- ${errors.join('\n- ')}`);
  return json as Storyboard;
}

export type BuildOptions = {
  storyboardPath: string;
  assetsDir: string;
  postPath: string;
  outPath: string;
  audioPath?: string;
};

const frontmatterTitle = (post: string): string => {
  const fence = post.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const raw = fence?.[1].match(/^title:\s*(.*)$/m)?.[1].trim() ?? '';
  return raw.replace(/^(["'])([\s\S]*)\1$/, '$2');
};

export function buildVideo(opts: BuildOptions): { errors: string[]; html?: string } {
  let sb: Storyboard;
  try {
    sb = parseStoryboard(JSON.parse(readFileSync(opts.storyboardPath, 'utf8')));
  } catch (err) {
    return { errors: [(err as Error).message] };
  }
  const post = readFileSync(opts.postPath, 'utf8');
  const title = frontmatterTitle(post);
  const errors: string[] = [];
  if (!title) errors.push(`post ${opts.postPath} has no frontmatter title`);

  let start = 0;
  const scenes: ResolvedScene[] = sb.scenes.map((s) => {
    const r: ResolvedScene = { id: s.id, type: s.type, start, duration: s.duration, caption: s.caption };
    start += s.duration;
    if (s.callout) r.callout = s.callout;
    if (s.focus) r.focus = s.focus;
    if (s.asset) {
      const mp4 = path.join(opts.assetsDir, `${s.asset}.mp4`);
      const jpg = path.join(opts.assetsDir, `${s.asset}.jpg`);
      if (existsSync(mp4)) {
        r.asset = { kind: 'video', dataUri: `data:video/mp4;base64,${readFileSync(mp4).toString('base64')}` };
      } else if (existsSync(jpg)) {
        r.asset = { kind: 'image', dataUri: `data:image/jpeg;base64,${readFileSync(jpg).toString('base64')}` };
      } else {
        errors.push(`scene ${s.id}: asset "${s.asset}" not found as ${mp4} or ${jpg}`);
      }
    }
    return r;
  });
  if (opts.audioPath && !existsSync(opts.audioPath)) errors.push(`audio file not found: ${opts.audioPath}`);
  if (errors.length) return { errors };

  const html = renderVideoHtml({
    slug: sb.slug,
    title,
    projectName: sb.project.name,
    projectUrl: sb.project.url,
    voice: sb.voice,
    durationS: start,
    audioDataUri: opts.audioPath
      ? `data:audio/mpeg;base64,${readFileSync(opts.audioPath).toString('base64')}`
      : undefined,
    scenes,
    claims: sb.scenes.map((s) => ({ sceneId: s.id, source: s.source })),
  });
  const checks = [...validateBlogVideoHtml(html).errors, ...checkClaimsGrounded(html, post)];
  if (checks.length) return { errors: checks };
  mkdirSync(path.dirname(opts.outPath), { recursive: true });
  writeFileSync(opts.outPath, html);
  return { errors: [], html };
}

const flag = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function main(): void {
  const args = process.argv.slice(2);
  const storyboardPath = flag(args, '--storyboard');
  const assetsDir = flag(args, '--assets');
  const postPath = flag(args, '--post');
  const outPath = flag(args, '--out');
  if (!storyboardPath || !assetsDir || !postPath || !outPath) {
    console.error(
      'usage: blog-video-build.ts --storyboard <sb.json> --assets <dir> --post content/blog/<slug>.md --out public/blog-videos/<slug>/index.html [--audio <narration.mp3>]',
    );
    process.exit(2);
  }
  const result = buildVideo({ storyboardPath, assetsDir, postPath, outPath, audioPath: flag(args, '--audio') });
  if (result.errors.length) {
    for (const e of result.errors) console.log(e);
    process.exit(1);
  }
  console.log(`OK ${outPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
