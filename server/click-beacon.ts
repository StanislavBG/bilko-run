import type { FastifyInstance } from 'fastify';
import { isBlogVideoPath } from './security-headers.js';

// Tiny click beacon injected into every HTML document so clicks are captured
// host-wide (SPA shell + every static-path app) without touching sibling repos.
// Never reads input values other than type submit/button.
export const BEACON_JS = `(function(){try{
if(location.pathname.indexOf('/admin')===0)return;
var S='a,button,[role=button],summary,input[type=submit],input[type=button],[data-track]';
document.addEventListener('click',function(e){try{
var t=e.target;if(!t||!t.closest)return;
var el=t.closest(S);if(!el)return;
var tag=el.tagName.toLowerCase();
var label=el.getAttribute('aria-label');
if(!label){label=(el.textContent||'').replace(/\\s+/g,' ').trim();
if(!label&&tag==='input'&&(el.type==='submit'||el.type==='button'))label=el.value||''}
navigator.sendBeacon('/api/analytics/click',JSON.stringify({path:location.pathname,tag:tag,id:el.id||'',label:String(label).slice(0,80),href:el.getAttribute('href')||''}))
}catch(x){}},true)
}catch(x){}})();`;

async function toHtml(payload: unknown): Promise<string | null> {
  if (typeof payload === 'string') return payload;
  if (Buffer.isBuffer(payload)) return payload.toString('utf-8');
  if (payload && typeof (payload as any).pipe === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of payload as AsyncIterable<Buffer | string>) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
  return null;
}

export function registerClickBeacon(app: FastifyInstance): void {
  app.addHook('onSend', async (req, reply, payload) => {
    if (isBlogVideoPath(req.url)) return payload;
    const ctype = String(reply.getHeader('content-type') ?? '');
    if (!ctype.startsWith('text/html')) return payload;
    if (/^\s*attachment\b/i.test(String(reply.getHeader('content-disposition') ?? ''))) return payload;
    const html = await toHtml(payload);
    if (html === null) return payload;
    const nonce = (req as any).cspNonce as string | undefined;
    const tag = `<script${nonce ? ` nonce="${nonce}"` : ''}>${BEACON_JS}</script>`;
    let idx = html.search(/<\/head>/i);
    if (idx === -1) idx = html.search(/<\/body>/i);
    reply.removeHeader('content-length');
    if (idx === -1) return html;
    return html.slice(0, idx) + tag + html.slice(idx);
  });
}
