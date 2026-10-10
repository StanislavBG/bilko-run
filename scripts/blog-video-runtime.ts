// Blog Video runtime: turns a resolved scene spec (real screenshots/clips as data URIs +
// captions) into one self-contained, deterministic HTML/JS video. The agent authors the story;
// this file owns controls, caption style, crossfades and zoom so every video looks the same.
// The emitted script uses arrow functions only (the validator rejects the `function` keyword).

export type SceneType = 'title' | 'text' | 'screen' | 'closing';
export type Rect = { x: number; y: number; w: number; h: number };

export type ResolvedScene = {
  id: string;
  type: SceneType;
  start: number;
  duration: number;
  caption: string;
  callout?: string;
  focus?: Rect;
  asset?: { kind: 'image' | 'video'; dataUri: string };
};

export type ResolvedSpec = {
  slug: string;
  title: string;
  projectName: string;
  projectUrl: string;
  voice: string;
  durationS: number;
  audioDataUri?: string;
  scenes: ResolvedScene[];
  claims: Array<{ sceneId: string; source: string }>;
};

const W = 1280;
const H = 720;
const PAD = 0.08;
const MAX_ZOOM = 2.5;
const FADE_S = 0.5;
const ZOOM_SHARE = 0.6;

// Runtime copy of focusTransform. Keep the math identical to the TS version below; a test
// evaluates this source and compares both on sample inputs.
export const FOCUS_TRANSFORM_SRC = `(focus, progress) => {
  const W = 1280, H = 720;
  const p = Math.max(0, Math.min(1, progress));
  const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const px = Math.max(0, focus.x - focus.w * 0.08), py = Math.max(0, focus.y - focus.h * 0.08);
  const qx = Math.min(W, focus.x + focus.w * 1.08), qy = Math.min(H, focus.y + focus.h * 1.08);
  const pw = Math.max(1, qx - px), ph = Math.max(1, qy - py);
  const s = Math.max(1, Math.min(2.5, W / pw, H / ph));
  const tx = Math.min(0, Math.max(W - W * s, W / 2 - s * (px + pw / 2)));
  const ty = Math.min(0, Math.max(H - H * s, H / 2 - s * (py + ph / 2)));
  return { scale: 1 + (s - 1) * e, tx: tx * e + 0, ty: ty * e + 0 };
}`;

/** Zoom from the full frame (progress 0) to the padded focus rect filling the stage. */
export const focusTransform = (focus: Rect, progress: number): { scale: number; tx: number; ty: number } => {
  const p = Math.max(0, Math.min(1, progress));
  const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // easeInOutCubic
  const px = Math.max(0, focus.x - focus.w * PAD);
  const py = Math.max(0, focus.y - focus.h * PAD);
  const qx = Math.min(W, focus.x + focus.w * (1 + PAD));
  const qy = Math.min(H, focus.y + focus.h * (1 + PAD));
  const pw = Math.max(1, qx - px);
  const ph = Math.max(1, qy - py);
  // scale fits the whole padded rect; never below 1 (no zoom-out past the frame)
  const s = Math.max(1, Math.min(MAX_ZOOM, W / pw, H / ph));
  // clamp so the image edge never enters the stage
  const tx = Math.min(0, Math.max(W - W * s, W / 2 - s * (px + pw / 2)));
  const ty = Math.min(0, Math.max(H - H * s, H / 2 - s * (py + ph / 2)));
  return { scale: 1 + (s - 1) * e, tx: tx * e + 0, ty: ty * e + 0 };
};

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const jsonForScript = (v: unknown): string =>
  JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

const media = (a: { kind: 'image' | 'video'; dataUri: string }, cls: string, id?: string): string =>
  a.kind === 'video'
    ? `<video class="${cls}"${id ? ` id="${id}"` : ''} src="${a.dataUri}" muted playsinline preload="auto"></video>`
    : `<img class="${cls}"${id ? ` id="${id}"` : ''} alt="" src="${a.dataUri}">`;

const sceneHtml = (s: ResolvedScene, i: number, bg?: ResolvedScene['asset'], spec?: ResolvedSpec): string => {
  const cap = esc(s.caption);
  const open = `<div class="sc ${s.type}" id="s${i}" style="z-index:${i + 1}">`;
  const backdrop = bg ? `<div class="bgwrap">${media(bg, 'bg')}</div><div class="dim"></div>` : '<div class="plain"></div>';
  switch (s.type) {
    case 'title':
      return `${open}${backdrop}<div class="fg"><div class="eyebrow in" data-d="0.2">${esc(spec?.projectName ?? '')}</div><h1 class="in" data-d="0.45">${esc(spec?.title ?? '')}</h1><p class="sub in" data-d="0.8">${cap}</p></div></div>`;
    case 'text':
      return `${open}<div class="plain"></div><div class="fg"><div class="rule in" data-d="0.1"></div><p class="big in" data-d="0.25">${cap}</p></div></div>`;
    case 'closing': {
      const shown = (spec?.projectUrl ?? '').replace(/^https?:\/\//, '');
      const px = Math.min(58, Math.floor(1100 / (Math.max(shown.length, 1) * 0.6)));
      const norm = (u: string): string => u.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
      const sub = norm(s.caption) === norm(shown) ? '' : `<p class="sub in" data-d="0.8">${cap}</p>`;
      return `${open}${backdrop}<div class="fg"><div class="eyebrow in" data-d="0.2">${esc(spec?.projectName ?? '')}</div><div class="link in" data-d="0.4" style="font-size:${px}px">${esc(shown)}</div>${sub}</div></div>`;
    }
    default: {
      const m = s.asset ? media(s.asset, 'shot', `m${i}`) : '';
      const ring = s.focus ? `<div class="ring" id="r${i}"></div>` : '';
      const chip = s.focus && s.callout ? `<div class="chip" id="c${i}">${esc(s.callout)}</div>` : '';
      return `${open}<div class="plain"></div><div class="zoom" id="z${i}">${m}</div>${ring}${chip}<div class="lt"><span>${cap}</span></div></div>`;
    }
  }
};

const CSS = `
:root{--bg:#1c1917;--fg:#faf5ee;--mut:#c9bcae;--acc:#f97316;--line:#44392f}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;background:var(--bg);overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--fg)}
#wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
#stage{position:relative;width:1280px;height:720px;flex:none;background:var(--bg);overflow:hidden}
.sc{position:absolute;inset:0;opacity:0;overflow:hidden}
.plain{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,#2b2420 0%,#1c1917 70%)}
.bgwrap{position:absolute;inset:-60px;overflow:hidden}
.bg{width:100%;height:100%;object-fit:cover;filter:blur(16px) brightness(.55) saturate(1.1);transform-origin:50% 50%}
.dim{position:absolute;inset:0;background:rgba(28,25,23,.55)}
.fg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 110px}
.eyebrow{font-size:26px;font-weight:800;letter-spacing:5px;text-transform:uppercase;color:var(--acc);margin-bottom:26px}
h1{font-size:62px;line-height:1.1;font-weight:800;letter-spacing:-1px;max-width:1040px}
.sub{font-size:28px;color:var(--mut);margin-top:28px;max-width:960px;line-height:1.3}
.big{font-size:54px;line-height:1.2;font-weight:800;max-width:1000px}
.rule{width:96px;height:6px;border-radius:3px;background:var(--acc);margin-bottom:34px}
.link{font-size:58px;font-weight:800;color:var(--acc);white-space:nowrap;max-width:1100px;line-height:1.15}
.closing .eyebrow{font-size:44px;letter-spacing:3px;color:var(--fg);margin-bottom:22px}
.zoom{position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:0 0}
.shot{display:block;width:1280px;height:720px;object-fit:fill}
.ring{position:absolute;left:0;top:0;border:4px solid var(--acc);border-radius:14px;box-shadow:0 0 0 2px rgba(0,0,0,.5),0 0 28px rgba(249,115,22,.65);opacity:0}
.chip{position:absolute;left:0;top:0;max-width:420px;padding:14px 22px;border-radius:14px;background:#1c1917;border:2px solid var(--acc);color:var(--fg);font-size:28px;font-weight:700;line-height:1.2;opacity:0;z-index:3}
.chip::before{content:"";position:absolute;width:14px;height:14px;background:#1c1917;transform:rotate(45deg);border:0 solid var(--acc)}
.chip.r::before{left:-9px;top:calc(50% - 7px);border-left-width:2px;border-bottom-width:2px}
.chip.l::before{right:-9px;top:calc(50% - 7px);border-top-width:2px;border-right-width:2px}
.chip.u::before{bottom:-9px;left:calc(50% - 7px);border-right-width:2px;border-bottom-width:2px}
.chip.d::before{top:-9px;left:calc(50% - 7px);border-top-width:2px;border-left-width:2px}
.lt{position:absolute;left:0;right:0;bottom:0;padding:70px 70px 58px;background:linear-gradient(to top,rgba(20,17,15,.92) 0%,rgba(20,17,15,.78) 55%,rgba(20,17,15,0) 100%);z-index:2}
.lt span{display:inline-block;border-left:6px solid var(--acc);padding-left:20px;font-size:36px;font-weight:700;line-height:1.2;max-width:1060px}
#ctl{position:absolute;left:0;right:0;bottom:0;height:48px;display:flex;align-items:center;gap:12px;padding:0 18px;background:rgba(28,25,23,.94);border-top:1px solid var(--line);z-index:100;opacity:1;transition:opacity .35s}
body.playing #ctl{opacity:0}
body.playing #stage:hover #ctl,#ctl:focus-within{opacity:1}
#ctl button{font:600 15px system-ui,sans-serif;color:var(--fg);background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 14px;cursor:pointer}
#ctl button:hover{border-color:var(--acc)}
#snd.blocked{background:var(--acc);color:#1c1917;border-color:var(--acc)}
#bar{flex:1;height:10px;border-radius:5px;background:var(--line);overflow:hidden;cursor:pointer}
#fill{height:100%;width:0;background:var(--acc)}
@media (prefers-reduced-motion:reduce){#ctl{transition:none}}
`;

const RUNTIME = (scenesJson: string, duration: number, hasAudio: boolean): string => `
const SC = ${scenesJson};
const D = ${duration};
const FADE = ${FADE_S};
const ZOOM = ${ZOOM_SHARE};
const hasAudio = ${hasAudio};
const $ = (id) => document.getElementById(id);
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const focusTransform = ${FOCUS_TRANSFORM_SRC};
const stage = $("stage"), aud = $("aud"), pp = $("pp"), snd = $("snd");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const place = (chip, r) => {
  const w = chip.offsetWidth, h = chip.offsetHeight, G = 20;
  const sp = { r: 1280 - r.x - r.w, l: r.x, d: 720 - r.y - r.h, u: r.y };
  let side = "r";
  ["l", "d", "u"].forEach((k) => { if (sp[k] > sp[side]) side = k; });
  let x = r.x + r.w + G, y = r.y + r.h / 2 - h / 2;
  if (side === "l") x = r.x - G - w;
  if (side === "u") { x = r.x + r.w / 2 - w / 2; y = r.y - G - h; }
  if (side === "d") { x = r.x + r.w / 2 - w / 2; y = r.y + r.h + G; }
  x = Math.max(16, Math.min(1280 - w - 16, x));
  y = Math.max(16, Math.min(720 - h - 150, y));
  chip.className = "chip " + side;
  return { x, y };
};

const render = (t) => {
  t = Math.max(0, Math.min(D, t));
  SC.forEach((s, i) => {
    const el = $("s" + i);
    const lt = Math.max(0, t - s.start);
    const dur = s.end - s.start;
    el.style.opacity = t < s.start ? 0 : (i === 0 ? 1 : clamp((t - s.start) / FADE));
    el.querySelectorAll(".in").forEach((n) => {
      const q = i === 0 ? 1 : ease((lt - Number(n.dataset.d)) / 0.6);
      n.style.opacity = q;
      n.style.transform = "translateY(" + ((1 - q) * 18) + "px)";
    });
    const bg = el.querySelector(".bg");
    if (bg) bg.style.transform = "scale(" + (1.04 + 0.08 * clamp(lt / dur)) + ")";
    if (s.type !== "screen") return;
    const m = $("m" + i);
    if (m && m.tagName === "VIDEO" && Math.abs(m.currentTime - lt) > 0.1) {
      try { m.currentTime = lt; } catch (e) { /* media not ready */ }
    }
    if (!s.focus) return;
    const f = focusTransform(s.focus, lt / (dur * ZOOM));
    $("z" + i).style.transform = "translate(" + f.tx + "px," + f.ty + "px) scale(" + f.scale + ")";
    const r = { x: s.focus.x * f.scale + f.tx, y: s.focus.y * f.scale + f.ty, w: s.focus.w * f.scale, h: s.focus.h * f.scale };
    const ring = $("r" + i);
    const q = ease((lt - dur * ZOOM) / 0.5);
    const pulse = 1 + 0.015 * Math.sin(lt * 5);
    ring.style.left = (r.x - 6) + "px"; ring.style.top = (r.y - 6) + "px";
    ring.style.width = (r.w + 12) + "px"; ring.style.height = (r.h + 12) + "px";
    ring.style.opacity = q;
    ring.style.transform = "scale(" + ((1.06 - 0.06 * q) * pulse) + ")";
    const chip = $("c" + i);
    if (chip) {
      const p = place(chip, r);
      const c = ease((lt - dur * ZOOM - 0.2) / 0.4);
      chip.style.left = p.x + "px"; chip.style.top = p.y + "px";
      chip.style.opacity = c;
      chip.style.transform = "translateY(" + ((1 - c) * 10) + "px)";
    }
  });
  $("fill").style.width = (t / D * 100) + "%";
};

let t = 0, playing = false, last = 0, raf = 0, blocked = false;
const setPlaying = (v) => {
  playing = v;
  document.body.classList.toggle("playing", v);
  pp.textContent = reduced ? "Next scene" : (v ? "Pause" : "Play");
};
const loop = (now) => {
  if (!playing) return;
  t += (now - last) / 1000; last = now;
  if (t >= D) { t = D; setPlaying(false); if (hasAudio) aud.pause(); }
  render(t);
  if (hasAudio && playing && Math.abs(aud.currentTime - t) > 0.3) aud.currentTime = t;
  if (playing) raf = requestAnimationFrame(loop);
};
const play = () => {
  if (reduced) return;
  if (t >= D) t = 0;
  setPlaying(true); last = performance.now();
  if (hasAudio) {
    if (Math.abs(aud.currentTime - t) > 0.15) aud.currentTime = t;
    const p = aud.play();
    if (p && p.catch) p.catch(() => { blocked = true; snd.textContent = "Tap for sound"; snd.classList.add("blocked"); });
  }
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
};
const pause = () => { setPlaying(false); if (hasAudio) aud.pause(); cancelAnimationFrame(raf); };
const seek = (x) => {
  t = Math.max(0, Math.min(D, x));
  if (hasAudio) { try { aud.currentTime = t; } catch (e) { /* audio not ready */ } }
  render(t);
};
window.smDemo = { duration: D, scenes: SC.map((s) => ({ id: s.id, start: s.start, end: s.end })), seek, play, pause };

const fit = () => {
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.transform = "scale(" + s + ")";
};
window.addEventListener("resize", fit); fit();

let step = 0;
const stepTo = (i) => { step = (i + SC.length) % SC.length; seek(step === SC.length - 1 ? D : SC[step].end - 0.01); };
pp.addEventListener("click", () => {
  if (reduced) { stepTo(step + 1); return; }
  if (playing) pause(); else play();
});
$("rs").addEventListener("click", () => { if (reduced) { stepTo(0); } else { seek(0); play(); } });
$("bar").addEventListener("click", (ev) => {
  const b = $("bar").getBoundingClientRect();
  const x = clamp((ev.clientX - b.left) / b.width) * D;
  if (reduced) { seek(x); return; }
  seek(x); if (playing) last = performance.now();
});
if (hasAudio) {
  snd.addEventListener("click", () => {
    if (blocked) { blocked = false; snd.classList.remove("blocked"); snd.textContent = "Sound on"; aud.muted = false; aud.currentTime = t; if (playing) aud.play(); return; }
    aud.muted = !aud.muted;
    snd.textContent = aud.muted ? "Sound off" : "Sound on";
  });
} else {
  snd.style.display = "none";
}

setPlaying(false);
if (reduced) { stepTo(0); } else { seek(0); play(); }
`;

export const renderVideoHtml = (spec: ResolvedSpec): string => {
  const firstShot = spec.scenes.find((s) => s.type === 'screen' && s.asset)?.asset;
  const scenes = spec.scenes
    .map((s, i) => sceneHtml(s, i, s.type === 'title' || s.type === 'closing' ? firstShot : undefined, spec))
    .join('\n  ');
  const scenesJson = jsonForScript(
    spec.scenes.map((s) => ({ id: s.id, type: s.type, start: s.start, end: s.start + s.duration, focus: s.focus ?? null })),
  );
  const hasAudio = Boolean(spec.audioDataUri);
  const audio = hasAudio ? `<audio id="aud" preload="auto" src="${spec.audioDataUri}"></audio>` : '<audio id="aud"></audio>';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="sm-demo-duration" content="${Math.round(spec.durationS)}">
<meta name="blog-video-voice" content="${esc(spec.voice)}">
<title>${esc(spec.title)}</title>
<style>${CSS}</style>
</head>
<body>
<div id="wrap"><div id="stage">
  ${scenes}
  <div id="ctl"><button id="pp" type="button">Pause</button><button id="rs" type="button">Restart</button><div id="bar"><div id="fill"></div></div><button id="snd" type="button">Sound on</button></div>
</div></div>
${audio}
<script type="application/json" id="blog-video-claims">${jsonForScript(spec.claims)}</script>
<script>${RUNTIME(scenesJson, spec.durationS, hasAudio)}</script>
</body>
</html>
`;
};
