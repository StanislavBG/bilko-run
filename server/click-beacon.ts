import type { FastifyInstance } from 'fastify';
import { isBlogVideoPath } from './security-headers.js';
import { VID_COOKIE, SID_COOKIE, VID_MAX_AGE_S, SID_IDLE_S } from './session-identity.js';

// Universal auto-capture beacon injected into every HTML document so clicks and
// pageviews are captured host-wide (SPA shell + every static-path app) without
// touching sibling repos. Identity contract: server/session-identity.ts.
// Never reads input values other than type submit/button. Clicks scrub PII
// (emails, long digit runs, href query/hash) and honor data-track / data-track-redact.
export const BEACON_JS = `(function(){try{
var VC='${VID_COOKIE}',SC='${SID_COOKIE}',LK='bilko_vid',W=window,D=document,L=location;
var UR=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ck(n){var a=D.cookie.split(';'),i,p,k;for(i=0;i<a.length;i++){p=a[i];k=p.indexOf('=');if(k>0&&p.slice(0,k).replace(/^\\s+/,'')===n){p=p.slice(k+1).replace(/\\s+$/,'');return UR.test(p)?p:''}}return ''}
function id(){try{if(crypto&&crypto.randomUUID)return crypto.randomUUID()}catch(x){}
return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:r&3|8).toString(16)})}
function touch(){var v=ck(VC),l='',sec=L.protocol==='https:'?'; Secure':'',s=ck(SC),at='; Path=/; SameSite=Lax'+sec;
try{l=localStorage.getItem(LK)||''}catch(x){}
if(UR.test(l))v=l;else if(!v)v=id();
D.cookie=VC+'='+v+'; Max-Age=${VID_MAX_AGE_S}'+at;
try{localStorage.setItem(LK,v)}catch(x){}
if(!s)s=id();
D.cookie=SC+'='+s+'; Max-Age=${SID_IDLE_S}'+at;
return{v:v,s:s}}
function adm(){return L.pathname.indexOf('/admin')===0}
var last=null,first=true;
function pv(){try{
if(adm()||L.pathname===last)return;
var i=touch(),sc=W.screen||{},b={path:L.pathname,referrer:first?D.referrer||'':'',screen:sc.width+'x'+sc.height,visitor_id:i.v,session_id:i.s},
q=L.search.replace(/^\\?/,'').split('&'),j,kv,k;
for(j=0;j<q.length;j++){kv=q[j].split('=');k=kv[0];
if(/^utm_(source|medium|campaign|term|content)$/.test(k))try{b[k]=decodeURIComponent((kv[1]||'').replace(/\\+/g,' ')).slice(0,100)}catch(x){}}
last=L.pathname;first=false;
navigator.sendBeacon('/api/analytics/pageview',JSON.stringify(b))
}catch(x){}}
['pushState','replaceState'].forEach(function(m){var o=history[m];if(typeof o!=='function')return;
history[m]=function(){var r=o.apply(this,arguments);try{pv()}catch(x){}return r}});
W.addEventListener('popstate',pv);
var S='a,button,[role=button],summary,input[type=submit],input[type=button],[data-track]';
D.addEventListener('click',function(e){try{
if(adm())return;
var t=e.target;if(!t||!t.closest)return;
var el=t.closest(S);if(!el)return;
var tag=el.tagName.toLowerCase(),tr=t.closest('[data-track]'),label=el.getAttribute('aria-label');
if(!label){label=(el.textContent||'').replace(/\\s+/g,' ').trim();
if(!label&&tag==='input'&&(el.type==='submit'||el.type==='button'))label=el.value||''}
label=t.closest('[data-track-redact]')?'':String(label).replace(/[^\\s@]+@[^\\s@]+\\.[^\\s@]+/g,'[email]').replace(/\\d{6,}/g,'#').slice(0,80);
var i=touch();
navigator.sendBeacon('/api/analytics/click',JSON.stringify({path:location.pathname,tag:tag,id:el.id||'',label:label,href:(el.getAttribute('href')||'').split('#')[0].split('?')[0],visitor_id:i.v,session_id:i.s,track:((tr&&tr.getAttribute('data-track'))||'').slice(0,60)}))
}catch(x){}},true);
pv()
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
