import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { track, trackFlow, logError, flush, initTelemetry, _resetForTest } from '../src/telemetry';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VID_A = '11111111-1111-4111-8111-111111111111';
const VID_B = '22222222-2222-4222-8222-222222222222';
const SID_A = '33333333-3333-4333-8333-333333333333';

function readCookie(name: string): string | null {
  const m = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return m ? m.slice(name.length + 1) : null;
}
function clearCookies() {
  for (const n of ['bilko_vid', 'bilko_sid']) document.cookie = `${n}=; Path=/; Max-Age=0`;
}

let beacon: ReturnType<typeof vi.fn>;

function sent(): { url: string; body: any }[] {
  return beacon.mock.calls.map(([url, blob]) => ({ url: url as string, blob: blob as Blob }))
    .map((c) => ({ url: c.url, body: (c.blob as any)._body }));
}

beforeEach(() => {
  _resetForTest();
  clearCookies();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  // Capture bodies synchronously (Blob contents are async in jsdom).
  beacon = vi.fn((_url: string, blob: Blob) => {
    const text = (globalThis as any).__lastText;
    void text;
    return true;
  });
  const OrigBlob = globalThis.Blob;
  vi.stubGlobal('Blob', class extends OrigBlob {
    _body: any;
    constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
      super(parts, opts);
      try { this._body = JSON.parse(String(parts[0])); } catch { this._body = null; }
    }
  });
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true, writable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('session identity cookies', () => {
  it('reuses valid cookie ids and rewrites sid', () => {
    document.cookie = `bilko_vid=${VID_A}; Path=/`;
    document.cookie = `bilko_sid=${SID_A}; Path=/`;
    initTelemetry({ app: 't', version: '1' });
    track('x');
    flush();
    const ev = sent()[0].body.batch[0];
    expect(ev.visitor_id).toBe(VID_A);
    expect(ev.session_id).toBe(SID_A);
    expect(readCookie('bilko_vid')).toBe(VID_A);
    expect(readCookie('bilko_sid')).toBe(SID_A);
    expect(localStorage.getItem('bilko_vid')).toBe(VID_A);
  });

  it('legacy localStorage vid wins over a differing cookie', () => {
    document.cookie = `bilko_vid=${VID_A}; Path=/`;
    localStorage.setItem('bilko_vid', VID_B);
    initTelemetry({ app: 't', version: '1' });
    track('x');
    flush();
    expect(sent()[0].body.batch[0].visitor_id).toBe(VID_B);
    expect(readCookie('bilko_vid')).toBe(VID_B);
  });

  it('rotates sid once the cookie is absent and never caches it', () => {
    initTelemetry({ app: 't', version: '1' });
    track('a');
    const first = readCookie('bilko_sid')!;
    expect(first).toMatch(UUID_RE);
    track('b');
    expect(readCookie('bilko_sid')).toBe(first);
    document.cookie = 'bilko_sid=; Path=/; Max-Age=0';
    track('c');
    const second = readCookie('bilko_sid')!;
    expect(second).toMatch(UUID_RE);
    expect(second).not.toBe(first);
    flush();
    const batch = sent()[0].body.batch;
    expect(batch[0].session_id).toBe(first);
    expect(batch[2].session_id).toBe(second);
    expect(batch[0].visitor_id).toBe(batch[2].visitor_id);
  });

  it('treats an invalid cookie id as absent', () => {
    document.cookie = 'bilko_vid=not-a-uuid; Path=/';
    initTelemetry({ app: 't', version: '1' });
    track('x');
    expect(readCookie('bilko_vid')).toMatch(UUID_RE);
  });
});

describe('touchSession call volume and id fallback', () => {
  it('a single logError writes exactly 2 cookies', () => {
    initTelemetry({ app: 't', version: '1' });
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
    const writes: string[] = [];
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get() { return desc.get!.call(document); },
      set(v: string) { writes.push(v); desc.set!.call(document, v); },
    });
    try {
      logError(new Error('boom'));
    } finally {
      delete (document as any).cookie;
    }
    expect(writes).toHaveLength(2);
  });

  it('produces a valid UUID visitor id when crypto.randomUUID is undefined', () => {
    vi.stubGlobal('crypto', {});
    initTelemetry({ app: 't', version: '1' });
    track('x');
    flush();
    const ev = sent()[0].body.batch[0];
    expect(ev.visitor_id).toMatch(UUID_RE);
    expect(ev.session_id).toMatch(UUID_RE);
  });
});

describe('endpoint', () => {
  it('is absolute off bilko.run', () => {
    initTelemetry({ app: 't', version: '1' });
    track('x');
    flush();
    expect(sent()[0].url).toBe('https://bilko.run/api/telemetry/event');
  });

  it('is relative on bilko.run and www.bilko.run', () => {
    for (const host of ['bilko.run', 'www.bilko.run']) {
      _resetForTest();
      beacon.mockClear();
      vi.stubGlobal('location', { ...window.location, hostname: host, pathname: '/', protocol: 'https:', href: `https://${host}/` });
      initTelemetry({ app: 't', version: '1' });
      track('x');
      flush();
      expect(sent()[0].url).toBe('/api/telemetry/event');
      vi.unstubAllGlobals();
      Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true, writable: true });
    }
  });

  it('initTelemetry({ endpoint }) overrides', () => {
    initTelemetry({ app: 't', version: '1', endpoint: 'https://example.test/t' });
    track('x');
    flush();
    expect(sent()[0].url).toBe('https://example.test/t/event');
  });
});

describe('uninitialized track()', () => {
  it('derives app slug from /projects/<slug>/ and batches to /event', () => {
    window.history.replaceState({}, '', '/projects/my-app/page');
    track('hello');
    flush();
    const calls = sent();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://bilko.run/api/telemetry/event');
    expect(calls[0].body.batch[0]).toMatchObject({ app: 'my-app', name: 'hello' });
    expect(calls.some((c) => c.url.includes('/api/analytics/event'))).toBe(false);
  });

  it("falls back to app 'bilko'", () => {
    track('hello');
    flush();
    expect(sent()[0].body.batch[0].app).toBe('bilko');
  });
});

describe('trackFlow and props', () => {
  it('sends flow.step with props and path', () => {
    window.history.replaceState({}, '', '/projects/my-app/');
    initTelemetry({ app: 't', version: '1' });
    trackFlow('checkout', 'start', { plan: 'pro' });
    flush();
    const ev = sent()[0].body.batch[0];
    expect(ev.name).toBe('checkout.start');
    expect(ev.props).toMatchObject({ flow: 'checkout', step: 'start', plan: 'pro', path: '/projects/my-app/' });
  });

  it('keeps a caller-provided path', () => {
    initTelemetry({ app: 't', version: '1' });
    track('x', { path: '/custom' });
    flush();
    expect(sent()[0].body.batch[0].props.path).toBe('/custom');
  });

  it('drops invalid flow/step silently', () => {
    initTelemetry({ app: 't', version: '1' });
    trackFlow('Bad Flow', 'start');
    trackFlow('ok', '-bad');
    trackFlow('a'.repeat(41), 'ok');
    flush();
    expect(beacon).not.toHaveBeenCalled();
  });

  it('stripPII still redacts email props', () => {
    initTelemetry({ app: 't', version: '1' });
    track('x', { email: 'a@b.c', ok: 1 });
    flush();
    expect(sent()[0].body.batch[0].props).toMatchObject({ email: '[redacted]', ok: 1 });
  });
});
