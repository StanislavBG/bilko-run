// Puts the current Bilko-DB registry snapshot into every SPA HTML shell as
// <script type="application/json" id="bilko-registry">, so the React site reads the live
// registry (src/data/projectsRegistry.ts) instead of the copy compiled into its bundle.
// A JSON script element is never executed, so the CSP needs no nonce or hash for it.
import type { FastifyInstance } from 'fastify';
import type { RegistryProject } from '../mcp-host-server/src/contract/registry.js';
import { getRegistrySnapshot, onRegistryChange } from './registry-runtime.js';

export const REGISTRY_ELEMENT_ID = 'bilko-registry';

/** The SPA shell's mount point (index.html); static-path app pages and server-built pages lack it. */
const SPA_ROOT_MARKER = '<div id="root">';
/** /projects/<slug>/... is a static-path app's own page, never the SPA shell. */
const STATIC_APP_PATH = /^\/projects\/[^/]+\//;

/** JSON for an HTML script element: `<` is escaped so no `</script>` or `<!--` can end it early. */
export function registryElement(snapshot: readonly RegistryProject[]): string {
  const json = JSON.stringify(snapshot).replace(/</g, '\\u003c');
  return `<script type="application/json" id="${REGISTRY_ELEMENT_ID}">${json}</script>`;
}

/** Insert the element before </body> (after </head> content is parsed), or append it. */
export function injectRegistryElement(html: string, element: string): string {
  const at = html.lastIndexOf('</body>');
  return at === -1 ? html + element : html.slice(0, at) + element + html.slice(at);
}

/**
 * onSend hook that stamps the registry element into SPA shell responses. Register it next to the
 * OG hook (after the security-headers hook, so HTML payloads are strings by then).
 */
export function registerRegistryInject(app: FastifyInstance): void {
  let element = registryElement(getRegistrySnapshot());
  onRegistryChange((snapshot) => {
    element = registryElement(snapshot);
  });

  app.addHook('onSend', async (req, reply, payload) => {
    const ctype = String(reply.getHeader('content-type') ?? '');
    if (!ctype.startsWith('text/html')) return payload;
    if (/^\s*attachment\b/i.test(String(reply.getHeader('content-disposition') ?? ''))) return payload;
    if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) return payload;
    const path = req.url.split('?', 1)[0];
    if (STATIC_APP_PATH.test(path)) return payload;
    const html = typeof payload === 'string' ? payload : payload.toString('utf-8');
    if (!html.includes(SPA_ROOT_MARKER) || html.includes(`id="${REGISTRY_ELEMENT_ID}"`)) return payload;
    reply.removeHeader('content-length');
    return injectRegistryElement(html, element);
  });
}
