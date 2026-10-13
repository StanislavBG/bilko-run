import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SHARE_IMAGE = { width: 1200, height: 630, maxBytes: 5 * 1024 * 1024 };
const ICON = { min: 128, max: 1024, maxBytes: 512 * 1024 };
/** Reads width/height from the PNG IHDR (signature, then width at 16, height at 20, big-endian). */
function readPngSize(buf) {
    if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE))
        return undefined;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
/** Returns a problem description, or undefined when the asset is valid. */
function checkAsset(ctxSlug, bundleDir, field, assetPath) {
    const prefix = `/projects/${ctxSlug}/`;
    const rel = assetPath.startsWith(prefix) ? assetPath.slice(prefix.length) : assetPath.replace(/^\/+/, '');
    const root = resolve(bundleDir);
    const file = resolve(root, rel);
    if (file !== root && !file.startsWith(root + sep))
        return 'path escapes the bundle directory';
    if (!existsSync(file) || !statSync(file).isFile())
        return 'file not found in the staged bundle';
    const buf = readFileSync(file);
    const size = readPngSize(buf);
    if (!size)
        return 'not a PNG';
    const { width, height } = size;
    if (field === 'shareImage') {
        if (width !== SHARE_IMAGE.width || height !== SHARE_IMAGE.height) {
            return `is ${width}x${height}, must be exactly ${SHARE_IMAGE.width}x${SHARE_IMAGE.height}`;
        }
        if (buf.length > SHARE_IMAGE.maxBytes)
            return `is ${buf.length} bytes, over the 5 MB limit`;
    }
    else {
        if (width !== height)
            return `is ${width}x${height}, must be square`;
        if (width < ICON.min || width > ICON.max)
            return `is ${width}x${height}, must be ${ICON.min}-${ICON.max} px`;
        if (buf.length > ICON.maxBytes)
            return `is ${buf.length} bytes, over the 512 KB limit`;
    }
    return undefined;
}
export const shareAssetsGate = async (ctx) => {
    const declared = ['icon', 'shareImage'].flatMap((field) => {
        const p = ctx.listing?.[field];
        return p ? [[field, p]] : [];
    });
    if (declared.length === 0) {
        return { name: 'share-assets', status: 'pass', details: 'no share assets declared' };
    }
    const problems = [];
    for (const [field, p] of declared) {
        const problem = checkAsset(ctx.slug, ctx.bundleDir, field, p);
        if (problem)
            problems.push(`${field} ${p}: ${problem}`);
    }
    if (problems.length > 0) {
        return { name: 'share-assets', status: 'fail', details: problems.join('; ') };
    }
    return { name: 'share-assets', status: 'pass', details: `valid: ${declared.map(([f]) => f).join(', ')}` };
};
