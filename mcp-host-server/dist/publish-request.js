import { resolve, sep } from 'node:path';
import { SlugSchema, RegistrySchema } from './contract/registry.js';
const GATE_NAMES = new Set(['budget', 'golden', 'a11y', 'audit']);
const MIN_BYPASS_REASON_LENGTH = 15;
export function projectDir(publicProjectsRoot, slug) {
    const parsed = SlugSchema.safeParse(slug);
    if (!parsed.success) {
        throw new Error(`invalid slug "${slug}": ${parsed.error.issues[0]?.message ?? 'does not match SlugSchema'}`);
    }
    const root = resolve(publicProjectsRoot);
    const dir = resolve(root, parsed.data);
    if (dir !== root && !dir.startsWith(root + sep)) {
        throw new Error(`slug "${slug}" resolves outside the public projects root (${dir})`);
    }
    return dir;
}
export function parseBypass(bypass, reason) {
    const names = (bypass ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    if (names.length === 0) {
        return { gates: new Set() };
    }
    if (names.includes('manifest')) {
        return { error: 'the manifest gate cannot be bypassed' };
    }
    for (const name of names) {
        if (!GATE_NAMES.has(name)) {
            return { error: `unknown gate name "${name}" — valid gates: ${[...GATE_NAMES].join(', ')}` };
        }
    }
    if (!reason || reason.trim().length < MIN_BYPASS_REASON_LENGTH) {
        return { error: `bypassReason is required (at least ${MIN_BYPASS_REASON_LENGTH} chars) when bypassing a gate` };
    }
    return { gates: new Set(names) };
}
export function parseRegistry(raw) {
    let data;
    try {
        data = JSON.parse(raw);
    }
    catch (e) {
        throw new Error(`registry is not valid JSON: ${e.message}`);
    }
    const result = RegistrySchema.safeParse(data);
    if (!result.success) {
        const issue = result.error.issues[0];
        const path = issue?.path ?? [];
        const index = typeof path[0] === 'number' ? path[0] : undefined;
        const slug = index !== undefined && Array.isArray(data) && typeof data[index]?.slug === 'string'
            ? data[index].slug
            : 'unknown';
        const field = path.slice(1).join('.') || 'unknown';
        throw new Error(`invalid registry entry (slug "${slug}", field "${field}"): ${issue?.message ?? 'validation failed'}`);
    }
    return result.data;
}
