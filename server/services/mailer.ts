/** Tiny Resend REST client over fetch. Disabled unless RESEND_API_KEY, MAIL_FROM and BILKO_INBOX are set. */

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;
const PT_ZONE = 'America/Los_Angeles';
const MEETING_FALLBACK = 'Bilko will email the meeting link before the session.';

type Env = Record<string, string | undefined>;

export interface MailAttachment {
  filename: string;
  /** base64 */
  content: string;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}

export type MailResult = { sent: true; id: string } | { sent: false; reason: string };

export function mailerConfigured(env: Env = process.env): boolean {
  return Boolean(env.RESEND_API_KEY && env.MAIL_FROM && env.BILKO_INBOX);
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!mailerConfigured()) return { sent: false, reason: 'unconfigured' };
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
        attachments: input.attachments,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[mailer] send failed', { status: res.status, detail: detail.slice(0, 300) });
      return { sent: false, reason: `http_${res.status}` };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: unknown };
    return { sent: true, id: typeof body.id === 'string' ? body.id : '' };
  } catch (err) {
    console.error('[mailer] send error', { message: err instanceof Error ? err.message : String(err) });
    return { sent: false, reason: 'error' };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPt(startMs: number): string {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: PT_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(startMs));
  return s;
}

export function bookingConfirmationEmail(p: {
  offerName: string;
  startMs: number;
  timeZone: string;
  meetingLink: string;
  icsContent: string;
  included?: Array<{ name: string; url: string }>;
}): { subject: string; text: string; html: string; attachments: MailAttachment[] } {
  const when = formatPt(p.startMs);
  const link = p.meetingLink.trim() ? `Meeting link: ${p.meetingLink.trim()}` : MEETING_FALLBACK;
  const subject = `Booked: ${p.offerName} ${when}`;
  const included = p.included ?? [];
  const text = [
    `You're booked: ${p.offerName}.`,
    `When: ${when}`,
    link,
    'The calendar invite is attached.',
    ...(included.length ? ['', 'Included with your order:', ...included.map((i) => `${i.name}: ${i.url}`)] : []),
    '',
    'Bilko',
  ].join('\n');
  const html =
    `<p>You're booked: <strong>${escapeHtml(p.offerName)}</strong>.</p>` +
    `<p>When: ${escapeHtml(when)}</p>` +
    `<p>${escapeHtml(link)}</p>` +
    '<p>The calendar invite is attached.</p>' +
    (included.length
      ? '<p>Included with your order:</p><ul>' +
        included.map((i) => `<li>${escapeHtml(i.name)}: ${escapeHtml(i.url)}</li>`).join('') +
        '</ul>'
      : '') +
    '<p>Bilko</p>';
  return {
    subject,
    text,
    html,
    attachments: [{ filename: 'bilko-session.ics', content: Buffer.from(p.icsContent, 'utf8').toString('base64') }],
  };
}

export function bookingNoticeEmail(p: {
  offerName: string;
  startMs: number;
  buyerEmail: string;
  intake: { repo: string; broken: string; done: string; contact: string };
}): { subject: string; text: string; html: string } {
  const when = formatPt(p.startMs);
  const rows: Array<[string, string]> = [
    ['Offer', p.offerName],
    ['When', when],
    ['Buyer', p.buyerEmail],
    ['Repo', p.intake.repo],
    ['What is broken', p.intake.broken],
    ['What done looks like', p.intake.done],
    ['Contact', p.intake.contact],
  ];
  return {
    subject: `New booking: ${p.offerName} ${when}`,
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    html: rows.map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</p>`).join(''),
  };
}
