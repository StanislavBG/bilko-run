import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildVideo, parseStoryboard } from '../scripts/blog-video-build.js';
import { checkClaimsGrounded, validateBlogVideoHtml } from '../scripts/blog-video.js';

const S1 = 'Every weather app tells you the temperature.';
const S2 = 'None of them tell you if it was actually nice enough to go outside.';

const scene = (id: string, type: string, duration: number, extra: Record<string, unknown> = {}) => ({
  id,
  type,
  duration,
  caption: 'Short caption here',
  source: S1,
  ...extra,
});
const screen = (id: string, extra: Record<string, unknown> = {}) =>
  scene(id, 'screen', 5, { asset: 'a1', focus: { x: 100, y: 100, w: 400, h: 300 }, source: S2, ...extra });

const validSb = () => ({
  slug: 'fixture-post',
  voice: 'af_heart',
  project: { name: 'OutdoorHours', url: 'https://bilko.run/projects/outdoor-hours/' },
  scenes: [
    scene('s1', 'title', 3),
    scene('s2', 'text', 4),
    screen('s3'),
    screen('s4'),
    screen('s5'),
    scene('s6', 'closing', 8),
  ],
});
// 3+4+5+5+5+8 = 30

const fail = (mutate: (sb: any) => void, msg: RegExp) => {
  const sb: any = validSb();
  mutate(sb);
  expect(() => parseStoryboard(sb)).toThrow(msg);
};

describe('parseStoryboard', () => {
  it('parses a valid 6-scene storyboard', () => {
    expect(parseStoryboard(validSb()).scenes).toHaveLength(6);
  });
  it('rejects durations not summing to 30', () => fail((s) => (s.scenes[1].duration = 3), /sum to 30/));
  it('rejects a first scene that is not title', () => fail((s) => (s.scenes[0].type = 'text'), /first scene must be/));
  it('rejects a last scene that is not closing', () => fail((s) => (s.scenes[5].type = 'text'), /last scene must be/));
  it('rejects fewer than 3 screen scenes', () =>
    fail((s) => {
      s.scenes[4] = scene('s5', 'text', 5);
    }, /at least 3 screen/));
  it('rejects a screen scene without asset', () => fail((s) => delete s.scenes[2].asset, /s3.*asset/));
  it('rejects a screen scene without focus', () => fail((s) => delete s.scenes[2].focus, /s3.*focus/));
  it('rejects focus outside 1280x720', () => fail((s) => (s.scenes[2].focus = { x: 1000, y: 0, w: 400, h: 300 }), /s3.*1280x720/));
  it('rejects a caption over 12 words', () =>
    fail((s) => (s.scenes[1].caption = 'one two three four five six seven eight nine ten eleven twelve thirteen'), /s2.*caption/));
  it('rejects a callout over 7 words', () =>
    fail((s) => (s.scenes[1].callout = 'one two three four five six seven eight'), /s2.*callout/));
  it('rejects a scene shorter than 3s', () =>
    fail((s) => {
      s.scenes[0].duration = 2;
      s.scenes[1].duration = 5;
    }, /s1.*between 3 and 8/));
  it('rejects a scene longer than 8s', () =>
    fail((s) => {
      s.scenes[1].duration = 9;
      s.scenes[5].duration = 3;
    }, /s2.*between 3 and 8/));
  it('rejects narrationSeconds > duration - 0.3', () => fail((s) => (s.scenes[1].narrationSeconds = 3.8), /s2.*narrationSeconds/));
  it('rejects a bad project url', () => fail((s) => (s.project.url = 'http://example.com'), /project\.url/));
});

describe('buildVideo', () => {
  const setup = (source2 = S2) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'bvb-'));
    const assets = path.join(dir, 'assets');
    mkdirSync(assets);
    const jpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
    writeFileSync(path.join(assets, 'a1.jpg'), jpg);
    writeFileSync(path.join(assets, 'a2.jpg'), jpg);
    writeFileSync(path.join(assets, 'a3.mp4'), Buffer.from('fakemp4'));
    const post = path.join(dir, 'post.md');
    writeFileSync(post, `---\nslug: "fixture-post"\ntitle: "Fixture Post"\n---\n\n${S1} ${S2}\n`);
    const sb: any = validSb();
    sb.scenes[3].asset = 'a2';
    sb.scenes[4].asset = 'a3';
    sb.scenes[2].source = source2;
    const sbPath = path.join(dir, 'sb.json');
    writeFileSync(sbPath, JSON.stringify(sb));
    return { dir, assets, post, sbPath, out: path.join(dir, 'out', 'fixture-post', 'index.html') };
  };

  it('builds a file that passes validation and grounding', () => {
    const t = setup();
    const r = buildVideo({ storyboardPath: t.sbPath, assetsDir: t.assets, postPath: t.post, outPath: t.out });
    expect(r.errors).toEqual([]);
    const html = readFileSync(t.out, 'utf8');
    expect(validateBlogVideoHtml(html).ok).toBe(true);
    expect(checkClaimsGrounded(html, readFileSync(t.post, 'utf8'))).toEqual([]);
    expect(html).toContain('Fixture Post');
  });

  it('refuses to write when a source is ungrounded', () => {
    const t = setup('This sentence is not in the post at all.');
    const r = buildVideo({ storyboardPath: t.sbPath, assetsDir: t.assets, postPath: t.post, outPath: t.out });
    expect(r.errors.join('\n')).toMatch(/source not found/);
    expect(existsSync(t.out)).toBe(false);
  });

  it('reports a missing asset without writing', () => {
    const t = setup();
    const sb: any = validSb();
    sb.scenes[2].asset = 'nope';
    sb.scenes[2].source = S2;
    writeFileSync(t.sbPath, JSON.stringify(sb));
    const r = buildVideo({ storyboardPath: t.sbPath, assetsDir: t.assets, postPath: t.post, outPath: t.out });
    expect(r.errors.join('\n')).toMatch(/asset "nope"/);
    expect(existsSync(t.out)).toBe(false);
  });
});
