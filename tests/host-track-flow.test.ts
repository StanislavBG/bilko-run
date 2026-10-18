import { describe, it, expect, beforeEach, vi } from 'vitest';

const sent: { url: string; body: string }[] = [];

beforeEach(() => {
  sent.length = 0;
  vi.stubGlobal('navigator', {
    sendBeacon: (url: string, blob: Blob) => {
      sent.push({ url, body: (blob as unknown as { __b: string }).__b });
      return true;
    },
  });
  vi.stubGlobal('Blob', class { __b: string; constructor(parts: string[]) { this.__b = parts.join(''); } });
  vi.stubGlobal('location', { pathname: '/pricing', protocol: 'https:' });
  vi.stubGlobal('document', { cookie: '' });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
});

async function load() {
  return import('../src/lib/telemetry');
}

const evt = () => JSON.parse(sent[0].body).batch[0];

describe('host trackFlow / trackScreen', () => {
  it('sends the host-kit payload shape to /api/telemetry/event', async () => {
    const { trackFlow } = await load();
    trackFlow('download', 'click', { plan: 'x' });
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/api/telemetry/event');
    const e = evt();
    expect(e.app).toBe('bilko');
    expect(e.name).toBe('download.click');
    expect(typeof e.visitor_id).toBe('string');
    expect(typeof e.session_id).toBe('string');
    expect(typeof e.ts).toBe('number');
    expect(e.props).toEqual({ plan: 'x', flow: 'download', step: 'click', path: '/pricing' });
  });

  it('drops invalid flow or step names', async () => {
    const { trackFlow } = await load();
    trackFlow('Bad Flow', 'click');
    trackFlow('ok', '-bad');
    trackFlow('ok', 'a'.repeat(41));
    expect(sent).toHaveLength(0);
  });

  it('redacts sensitive prop keys', async () => {
    const { trackFlow } = await load();
    trackFlow('buy', 'start', { email: 'a@b.c', apiKey: 'k', ok: 1 });
    const p = evt().props;
    expect(p.email).toBe('[redacted]');
    expect(p.apiKey).toBe('[redacted]');
    expect(p.ok).toBe(1);
  });

  it('trackScreen sends screen_view', async () => {
    const { trackScreen } = await load();
    trackScreen('home');
    const e = evt();
    expect(e.name).toBe('screen_view');
    expect(e.props).toEqual({ screen: 'home', path: '/pricing' });
  });
});
