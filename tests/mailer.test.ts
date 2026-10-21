import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  mailerConfigured,
  sendMail,
  bookingConfirmationEmail,
  bookingNoticeEmail,
} from '../server/services/mailer.js';

const ENV = { RESEND_API_KEY: 'rk_test', MAIL_FROM: 'Bilko <bilko@example.test>', BILKO_INBOX: 'inbox@example.test' };
const START = Date.UTC(2026, 6, 15, 20, 0, 0); // 1:00 PM PDT
const WINTER = Date.UTC(2026, 11, 15, 20, 0, 0); // 12:00 PM PST
const INTAKE = { repo: 'https://github.com/acme/app', broken: 'CI is flaky', done: 'Green main', contact: 'ops@acme.test' };

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('mailerConfigured', () => {
  it('needs all three vars', () => {
    expect(mailerConfigured(ENV)).toBe(true);
    expect(mailerConfigured({ ...ENV, RESEND_API_KEY: '' })).toBe(false);
    expect(mailerConfigured({ ...ENV, MAIL_FROM: undefined })).toBe(false);
    expect(mailerConfigured({ ...ENV, BILKO_INBOX: '' })).toBe(false);
  });
});

describe('sendMail', () => {
  it('short-circuits when unconfigured without fetching', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const r = await sendMail({ to: 'a@b.test', subject: 's', text: 't' });
    expect(r).toEqual({ sent: false, reason: 'unconfigured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts to Resend and returns the id', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'em_1' }) });
    const r = await sendMail({
      to: 'a@b.test',
      subject: 's',
      text: 't',
      html: '<p>t</p>',
      attachments: [{ filename: 'x.ics', content: 'QQ==' }],
    });
    expect(r).toEqual({ sent: true, id: 'em_1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer rk_test');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      from: ENV.MAIL_FROM,
      to: ['a@b.test'],
      subject: 's',
      text: 't',
      html: '<p>t</p>',
      attachments: [{ filename: 'x.ics', content: 'QQ==' }],
    });
  });

  it('returns sent:false on non-2xx', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, text: async () => 'bad' });
    const r = await sendMail({ to: 'a@b.test', subject: 's', text: 't' });
    expect(r.sent).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[mailer]'), expect.anything());
  });

  it('returns sent:false when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const r = await sendMail({ to: 'a@b.test', subject: 's', text: 't' });
    expect(r.sent).toBe(false);
  });
});

describe('bookingConfirmationEmail', () => {
  it('renders PT time, signs Bilko, attaches the ics', () => {
    const m = bookingConfirmationEmail({
      offerName: 'Agent Ops Hour',
      startMs: START,
      timeZone: 'Europe/Berlin',
      meetingLink: 'https://meet.example.test/x',
      icsContent: 'BEGIN:VCALENDAR',
    });
    expect(m.text).toContain('PDT');
    expect(m.text).toContain('https://meet.example.test/x');
    expect(m.text.trim().endsWith('Bilko')).toBe(true);
    expect(m.attachments).toEqual([
      { filename: 'bilko-session.ics', content: Buffer.from('BEGIN:VCALENDAR').toString('base64') },
    ]);
    expect(bookingConfirmationEmail({ offerName: 'x', startMs: WINTER, timeZone: 'UTC', meetingLink: '', icsContent: '' }).text).toContain('PST');
  });

  it('falls back when meetingLink is empty', () => {
    const m = bookingConfirmationEmail({ offerName: 'x', startMs: START, timeZone: 'UTC', meetingLink: '', icsContent: 'x' });
    expect(m.text).toContain('Bilko will email the meeting link before the session.');
    expect(m.html).toContain('Bilko will email the meeting link before the session.');
  });
});

describe('bookingConfirmationEmail included downloads', () => {
  const base = { offerName: 'Setup', startMs: START, timeZone: 'UTC', meetingLink: '', icsContent: 'x' };

  it('is byte-identical without included', () => {
    expect(bookingConfirmationEmail({ ...base, included: [] })).toEqual(bookingConfirmationEmail(base));
  });

  it('lists name and url in text and escaped html, persona only', () => {
    const m = bookingConfirmationEmail({
      ...base,
      included: [{ name: 'Kit <b>', url: 'https://bilko.run/api/web-products/k/download?session_id=cs_1&x=2' }],
    });
    expect(m.text).toContain('Kit <b>: https://bilko.run/api/web-products/k/download?session_id=cs_1&x=2');
    expect(m.html).toContain('Kit &lt;b&gt;');
    expect(m.html).toContain('session_id=cs_1&amp;x=2');
    expect(`${m.text}${m.html}`.toLowerCase()).not.toContain('stanislav');
    expect(m.text.trim().endsWith('Bilko')).toBe(true);
  });
});

describe('bookingNoticeEmail', () => {
  it('has subject and every intake field', () => {
    const m = bookingNoticeEmail({ offerName: 'Agent Ops Hour', startMs: START, buyerEmail: 'buyer@x.test', intake: INTAKE });
    expect(m.subject).toMatch(/^New booking: Agent Ops Hour .*PDT/);
    for (const v of [...Object.values(INTAKE), 'buyer@x.test']) expect(m.text).toContain(v);
  });

  it('escapes user-supplied values in html', () => {
    const m = bookingNoticeEmail({
      offerName: 'Hour',
      startMs: START,
      buyerEmail: 'b@x.test',
      intake: { ...INTAKE, broken: '<script>alert(1)</script>' },
    });
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
  });
});

describe('persona', () => {
  it('never leaks the owner name', () => {
    const rendered = [
      bookingConfirmationEmail({ offerName: 'Hour', startMs: START, timeZone: 'UTC', meetingLink: '', icsContent: 'x' }),
      bookingNoticeEmail({ offerName: 'Hour', startMs: START, buyerEmail: 'b@x.test', intake: INTAKE }),
    ].map((m) => `${m.subject}\n${m.text}\n${m.html}`).join('\n');
    expect(rendered.toLowerCase()).not.toContain('stanislav');
    const src = readFileSync(new URL('../server/services/mailer.ts', import.meta.url), 'utf8');
    expect(src.toLowerCase()).not.toContain('stanislav');
    expect(src).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});
