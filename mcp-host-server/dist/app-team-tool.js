/**
 * Core of the owner-facing `app_team` MCP tool.
 *
 * Lists, adds/updates or removes members of an app's Bilko-DB team through the host's team API:
 *   GET    /api/db/<slug>/team
 *   PUT    /api/db/<slug>/team/members/<email>   JSON { role: 'owner' | 'member' }
 *   DELETE /api/db/<slug>/team/members/<email>
 * authenticated with the registry-scope admin key. Only the repo bound to the slug
 * (host.localPath) may call it; the check runs before any network call.
 *
 * Pure of the MCP SDK (server.ts registers the tool). The key is never printed.
 */
import { readFile as fsReadFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseRegistry } from './publish-request.js';
import { readLatestRegistryRaw } from './registry-source.js';
import { assertCallerOwnsSlug } from './ownership.js';
export const DEFAULT_REGISTRY_KEY_PATH = join('.config', 'bilko-host', 'registry-key');
const MISSING_KEY_TEXT = 'No registry key: set BILKO_REGISTRY_KEY, or BILKO_REGISTRY_KEY_FILE, or write ~/.config/bilko-host/registry-key. ' +
    'The owner must mint a registry-scope admin key first.';
/** Registry key from BILKO_REGISTRY_KEY, else the file at BILKO_REGISTRY_KEY_FILE, else ~/.config/bilko-host/registry-key. */
export async function registryKey(env, readFile) {
    const direct = env.BILKO_REGISTRY_KEY?.trim();
    if (direct)
        return direct;
    const file = env.BILKO_REGISTRY_KEY_FILE?.trim() || join(homedir(), DEFAULT_REGISTRY_KEY_PATH);
    try {
        const value = (await readFile(file)).trim();
        return value || undefined;
    }
    catch {
        return undefined;
    }
}
async function errorCode(res) {
    try {
        const body = (await res.json());
        if (typeof body?.error === 'string')
            return body.error;
    }
    catch {
        // Not JSON.
    }
    return res.statusText || 'unknown_error';
}
export async function appTeam(input, deps) {
    const { slug, callerRepoPath, action, email, role } = input;
    const fail = (text) => ({ ok: false, text });
    const env = deps.env ?? process.env;
    const readFile = deps.readFile ?? ((p) => fsReadFile(p, 'utf8'));
    const fetchFn = deps.fetch ?? fetch;
    // ── Ownership first: no network call for a caller that does not own the slug ──
    try {
        const projects = parseRegistry((await readLatestRegistryRaw(deps.hostRoot)).raw);
        const entry = projects.find((p) => p.slug === slug);
        if (!entry)
            return fail(`slug "${slug}" not found in registry.`);
        assertCallerOwnsSlug(entry, callerRepoPath);
    }
    catch (e) {
        return fail(e.message);
    }
    if (action !== 'list') {
        if (!email || !email.trim())
            return fail(`email is required for action "${action}"`);
        if (action === 'set' && role !== 'owner' && role !== 'member') {
            return fail('role is required for action "set" and must be "owner" or "member"');
        }
    }
    const key = await registryKey(env, readFile);
    if (!key)
        return fail(MISSING_KEY_TEXT);
    const base = (env.BILKO_HOST_URL || 'https://bilko.run').replace(/\/+$/, '');
    const teamUrl = `${base}/api/db/${encodeURIComponent(slug)}/team`;
    const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json' };
    let url;
    let init;
    if (action === 'list') {
        url = teamUrl;
        init = { method: 'GET', headers };
    }
    else {
        url = `${teamUrl}/members/${encodeURIComponent(email.trim())}`;
        init = action === 'set'
            ? { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) }
            : { method: 'DELETE', headers };
    }
    let res;
    try {
        res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(15_000) });
    }
    catch (e) {
        return fail(`app_team ${action} "${slug}": request failed: ${e.message}`);
    }
    if (!res.ok)
        return fail(`app_team ${action} "${slug}" failed: HTTP ${res.status} ${await errorCode(res)}`);
    let body;
    try {
        body = await res.json();
    }
    catch {
        body = undefined;
    }
    if (action === 'list') {
        const members = (body?.members ?? []).filter((m) => m && typeof m.email === 'string');
        if (members.length === 0)
            return { ok: true, text: `team "${slug}": no members` };
        const lines = members.map((m) => `${m.email}\t${m.role}${m.addedAt ? `\tadded ${m.addedAt}` : ''}`);
        return { ok: true, text: [`team "${slug}": ${members.length} member(s)`, ...lines].join('\n') };
    }
    if (action === 'set') {
        const r = (body ?? {});
        const verb = r.created ? 'added' : 'updated';
        return { ok: true, text: `team "${slug}": ${verb} ${r.email ?? email} as ${r.role ?? role}` };
    }
    return { ok: true, text: `team "${slug}": removed ${email}` };
}
