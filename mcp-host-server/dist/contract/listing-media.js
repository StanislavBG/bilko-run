export const HOSTED_MEDIA_RE = /^\/projects\/([a-z0-9-]+)\/_media\/([0-9a-f]{64})\.(png|mp4|webm)$/;
export function hostedMediaPath(slug, sha256, ext) {
    return `/projects/${slug}/_media/${sha256}.${ext}`;
}
export function parseHostedMediaPath(path) {
    const m = HOSTED_MEDIA_RE.exec(path);
    if (!m)
        return undefined;
    return { slug: m[1], sha256: m[2], ext: m[3] };
}
export function isHostedMediaPath(path) {
    return HOSTED_MEDIA_RE.test(path);
}
