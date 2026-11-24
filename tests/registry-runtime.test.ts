// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import Fastify from 'fastify';
import { dbAll, dbRun, initDb } from '../server/db.js';
import { putProject, deleteProject, listProjects } from '../server/services/registry-db.js';
import {
  initRegistry, getRegistrySnapshot, refreshRegistry, onRegistryChange, findRegistryFile,
} from '../server/registry-runtime.js';
import { registerProjectCatalogRoutes } from '../server/routes/project-catalog.js';
import { CATALOG_PROJECTS } from '../src/data/projectCatalog.js';
import { AGENT_OFFERS } from '../shared/agent-offers.js';

const REPO_FILE = resolve(__dirname, '..', 'src/data/standalone-projects.json');

function entry(slug: string, extra: Record<string, unknown> = {}) {
  return {
    slug,
    name: slug.toUpperCase(),
    tagline: `${slug} tagline`,
    category: 'Test',
    status: 'live',
    year: 2026,
    host: { kind: 'static-path', path: `/projects/${slug}/` },
    ...extra,
  };
}

let dir: string;
beforeAll(async () => {
  await initDb();
  dir = mkdtempSync(join(tmpdir(), 'registry-runtime-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

beforeEach(async () => {
  await dbRun('DELETE FROM bilko_db_projects');
  await dbRun('DELETE FROM bilko_db_project_log');
  await dbRun('DELETE FROM bilko_db_meta');
  await refreshRegistry();
});

function writeRegistry(name: string, entries: unknown[]): string {
  const file = join(dir, name);
  writeFileSync(file, JSON.stringify(entries, null, 2));
  return file;
}

describe('initRegistry', () => {
  it('finds the repo registry file by default', () => {
    expect(findRegistryFile()).toBe(REPO_FILE);
  });

  it('imports the registry file into Bilko-DB, then loads it into the snapshot', async () => {
    const file = writeRegistry('a.json', [entry('alpha'), entry('beta')]);
    const loaded = await initRegistry({ file });
    expect(loaded.map((p) => p.slug)).toEqual(['alpha', 'beta']);
    expect(getRegistrySnapshot().map((p) => p.slug)).toEqual(['alpha', 'beta']);
    expect((await listProjects()).map((p) => p.slug)).toEqual(['alpha', 'beta']);
    const log = await dbAll<{ action: string; actor: string }>(`SELECT action, actor FROM bilko_db_project_log`);
    expect(log).toEqual([{ action: 'import', actor: 'boot:file-import' }]);
  });

  it('keeps the DB registry once the API has written (the file no longer wins)', async () => {
    await putProject(entry('api-only'), 'test');
    const file = writeRegistry('b.json', [entry('from-file')]);
    await initRegistry({ file });
    expect(getRegistrySnapshot().map((p) => p.slug)).toEqual(['api-only']);
  });

  it('loads the DB as is when the file is missing', async () => {
    await putProject(entry('kept'), 'test');
    await initRegistry({ file: join(dir, 'missing.json') });
    expect(getRegistrySnapshot().map((p) => p.slug)).toEqual(['kept']);
  });

  it('boots an empty DB with no file to an empty registry and exactly one warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await initRegistry({ file: null });
      expect(getRegistrySnapshot()).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('logs an invalid file and keeps the DB rows', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await putProject(entry('kept'), 'test');
      await dbRun(`DELETE FROM bilko_db_meta`); // file is the writer again
      const file = join(dir, 'bad.json');
      writeFileSync(file, '[{"slug": "x"}]');
      await initRegistry({ file });
      expect(getRegistrySnapshot().map((p) => p.slug)).toEqual(['kept']);
      expect(err).toHaveBeenCalledTimes(1);
    } finally {
      err.mockRestore();
    }
  });
});

describe('refreshRegistry and onRegistryChange', () => {
  it('reloads the snapshot and calls listeners only when the content changed', async () => {
    const seen: string[][] = [];
    const off = onRegistryChange((s) => seen.push(s.map((p) => p.slug)));
    try {
      await putProject(entry('one'), 'test');
      expect(getRegistrySnapshot()).toEqual([]); // not refreshed yet
      await refreshRegistry();
      expect(getRegistrySnapshot().map((p) => p.slug)).toEqual(['one']);
      await refreshRegistry(); // nothing changed
      await putProject(entry('two'), 'test');
      await refreshRegistry();
      await deleteProject('one', 'test');
      await refreshRegistry();
      expect(seen).toEqual([['one'], ['one', 'two'], ['two']]);
    } finally {
      off();
    }
    await putProject(entry('three'), 'test');
    await refreshRegistry();
    expect(seen).toHaveLength(3); // unsubscribed
  });

  it('a throwing listener does not stop the others', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const calls: number[] = [];
    const offA = onRegistryChange(() => { throw new Error('boom'); });
    const offB = onRegistryChange((s) => calls.push(s.length));
    try {
      await putProject(entry('one'), 'test');
      await refreshRegistry();
      expect(calls).toEqual([1]);
      expect(err).toHaveBeenCalledTimes(1);
    } finally {
      offA(); offB(); err.mockRestore();
    }
  });

  it('the snapshot is frozen so one reader cannot change it for the others', async () => {
    await putProject(entry('one'), 'test');
    await refreshRegistry();
    expect(Object.isFrozen(getRegistrySnapshot())).toBe(true);
  });
});

describe('catalog reads the snapshot', () => {
  const app = Fastify();
  beforeAll(async () => {
    registerProjectCatalogRoutes(app, { listOffers: async () => AGENT_OFFERS });
    await app.ready();
  });
  afterAll(() => app.close());

  async function mcp(name: string, args: Record<string, unknown>) {
    const res = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
    });
    expect(res.statusCode).toBe(200);
    return res.json().result as { isError?: boolean; content: { text: string }[] };
  }

  it('seeded from the repo file, GET /api/projects and list_projects match the bundled catalog', async () => {
    await initRegistry({ file: REPO_FILE });
    const res = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    const body = res.json();
    const strip = (ps: { offers?: unknown }[]) => ps.map(({ offers: _o, ...rest }) => rest);
    expect(strip(body.projects)).toEqual(CATALOG_PROJECTS);
    const listed = JSON.parse((await mcp('list_projects', {})).content[0]!.text);
    expect(strip(listed.projects)).toEqual(CATALOG_PROJECTS);
    expect(listed.projects.map((p: { offers: unknown }) => p.offers)).toEqual(body.projects.map((p: { offers: unknown }) => p.offers));
  });

  it('follows registry changes: public entries appear, non-public ones never do', async () => {
    await putProject(entry('seeded-public', { public: true, listing: { audience: 'testers' } }), 'test');
    await putProject(entry('seeded-hidden'), 'test');
    await refreshRegistry();
    const body = (await app.inject({ method: 'GET', url: '/api/projects' })).json();
    expect(body.projects.map((p: { slug: string }) => p.slug)).toEqual(['seeded-public']);
    expect(body.projects[0]).toMatchObject({
      name: 'SEEDED-PUBLIC',
      url: 'https://bilko.run/projects/seeded-public/',
      audience: 'testers',
      share_image_url: 'https://bilko.run/og/seeded-public.png',
    });

    const got = await mcp('get_project', { slug: 'seeded-public' });
    expect(JSON.parse(got.content[0]!.text).slug).toBe('seeded-public');
    const hidden = await mcp('get_project', { slug: 'seeded-hidden' });
    expect(hidden.isError).toBe(true);

    await deleteProject('seeded-public', 'test');
    await refreshRegistry();
    expect((await app.inject({ method: 'GET', url: '/api/projects' })).json().projects).toEqual([]);
    expect((await mcp('get_project', { slug: 'seeded-public' })).isError).toBe(true);
  });
});
