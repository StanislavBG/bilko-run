import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SHARE_IMAGE = { width: 1200, height: 630, maxBytes: 5 * 1024 * 1024 };
const ICON = { min: 128, max: 1024, maxBytes: 512 * 1024 };
const VIDEO = { maxBytes: 8 * 1024 * 1024 };
const WEBM_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
/** Reads at most the first 12 bytes of a file; never the whole video. */
function readHead(file) {
    const fd = openSync(file, 'r');
    try {
        const head = Buffer.alloc(12);
        const n = readSync(fd, head, 0, 12, 0);
        return head.subarray(0, n);
    }
    finally {
        closeSync(fd);
    }
}
/** Container signature must match the extension (.mp4: 'ftyp' at bytes 4-7; .webm: EBML magic), then size cap. */
function checkVideo(file) {
    const head = readHead(file);
    if (extname(file).toLowerCase() === '.webm') {
        if (head.length < 4 || !head.subarray(0, 4).equals(WEBM_SIGNATURE))
            return 'not a WebM';
    }
    else if (head.length < 8 || head.subarray(4, 8).toString('latin1') !== 'ftyp') {
        return 'not an MP4';
    }
    const bytes = statSync(file).size;
    if (bytes > VIDEO.maxBytes)
        return `is ${bytes} bytes, over the 8 MB limit`;
    return undefined;
}
/** Reads width/height from the PNG IHDR (signature, then width at 16, height at 20, big-endian). */
function readPngSize(buf) {
    if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE))
        return undefined;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
/** Absolute path of a declared asset inside the bundle, or undefined when it escapes the bundle. */
function resolveAsset(ctxSlug, bundleDir, assetPath) {
    const prefix = `/projects/${ctxSlug}/`;
    const rel = assetPath.startsWith(prefix) ? assetPath.slice(prefix.length) : assetPath.replace(/^\/+/, '');
    const root = resolve(bundleDir);
    const file = resolve(root, rel);
    return file !== root && file.startsWith(root + sep) ? file : undefined;
}
/** Returns a problem description, or undefined when the asset is valid. */
function checkAsset(ctxSlug, bundleDir, field, assetPath) {
    const file = resolveAsset(ctxSlug, bundleDir, assetPath);
    if (!file)
        return 'path escapes the bundle directory';
    if (!existsSync(file) || !statSync(file).isFile())
        return 'file not found in the staged bundle';
    if (field === 'video')
        return checkVideo(file);
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
function declaredAssets(ctx) {
    return ['icon', 'shareImage', 'video'].flatMap((field) => {
        const p = ctx.listing?.[field];
        return p ? [[field, p]] : [];
    });
}
/**
 * Absolute paths of declared share assets that pass this gate's checks. The budget gate
 * leaves these out of its gzip sum: they are already capped here, and PNGs and videos barely gzip.
 */
export function validShareAssetFiles(ctx) {
    const files = new Set();
    for (const [field, p] of declaredAssets(ctx)) {
        if (checkAsset(ctx.slug, ctx.bundleDir, field, p))
            continue;
        const file = resolveAsset(ctx.slug, ctx.bundleDir, p);
        if (file)
            files.add(file);
    }
    return files;
}
export const shareAssetsGate = async (ctx) => {
    const declared = declaredAssets(ctx);
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
