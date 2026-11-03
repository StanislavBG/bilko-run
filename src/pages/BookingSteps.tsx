import { useEffect, useState } from 'react';
import { BILKO_CONTACT_EMAIL } from '../../shared/bilko-profile.js';
import { FREE_HOUR_TOPICS } from '../../shared/free-hour-topics.js';
import { googleCalendarUrl, outlookCalendarUrl, type SlotView } from '../lib/bookingView.js';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type Msg = 'already_booked' | 'slot_unavailable' | 'rate' | 'down' | 'invalid' | 'cancelled' | 'reschedule_failed';

export interface Booked { startMs: number; endMs: number; ics: string; token: string; email: string }

const Mail = () => <a href={`mailto:${BILKO_CONTACT_EMAIL}`}>{BILKO_CONTACT_EMAIL}</a>;

export function Notice({ msg }: { msg: Msg | null }) {
  if (!msg) return null;
  let body: React.ReactNode;
  switch (msg) {
    case 'already_booked': body = <>You've already booked your free hour with this email. Write to <Mail /> to change it.</>; break;
    case 'slot_unavailable': body = <>That time was just taken. Pick another.</>; break;
    case 'rate': body = <>Too many tries. Please try again in an hour.</>; break;
    case 'down': body = <>Booking isn't working right now. Write to <Mail /> and we'll set it up by hand.</>; break;
    case 'invalid': body = <>Check your email address and try again.</>; break;
    case 'reschedule_failed': body = <>Couldn't move your booking. Pick another time, or write to <Mail />.</>; break;
    default: body = <>Cancelled. Pick another time whenever you're ready.</>;
  }
  return <p className="bk-notice" role="alert" style={{ margin: '16px 0 0' }}>{body}</p>;
}

interface DetailsProps {
  pv: SlotView;
  email: string;
  setEmail: (v: string) => void;
  topic: string;
  setTopic: (v: string) => void;
  tags: string[];
  toggleTag: (t: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  busy: boolean;
  msg: Msg | null;
  onChange: () => void;
  onSubmit: () => void;
}

export function DetailsStep(p: DetailsProps) {
  const valid = EMAIL_RE.test(p.email.trim());
  const { pv } = p;
  return (
    <>
      <h2 style={{ marginTop: 20 }}>Your details</h2>
      <div className="bk-summary" style={{ marginTop: 16 }}>
        <div className="bk-leaf"><small>{pv.mon}</small>{pv.day}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '600 15px var(--bk-sans)' }}>{pv.dateLong}</div>
          <div style={{ font: '400 13.5px var(--bk-sans)', color: 'var(--bk-body)' }}>{pv.time} – {pv.timeEnd} {pv.tzAbbr} · Video call</div>
        </div>
        <button type="button" className="bk-link" onClick={p.onChange}>Change</button>
      </div>
      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); if (valid && !p.busy) p.onSubmit(); }}
        style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div>
          <label htmlFor="bk-email" style={{ font: '600 13.5px var(--bk-sans)' }}>
            Email <span style={{ font: '400 12.5px var(--bk-sans)', color: 'var(--bk-muted)' }}>for the invite and video link</span>
          </label>
          <input
            id="bk-email"
            className="bk-input"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={p.email}
            onChange={(e) => p.setEmail(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </div>
        <div>
          <div style={{ font: '600 13.5px var(--bk-sans)' }}>
            What are you working on? <span style={{ font: '400 12.5px var(--bk-sans)', color: 'var(--bk-muted)' }}>Optional</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0' }}>
            {FREE_HOUR_TOPICS.map((t) => (
              <button key={t} type="button" className="bk-chip" aria-pressed={p.tags.includes(t)} onClick={() => p.toggleTag(t)}>{t}</button>
            ))}
          </div>
          <textarea
            className="bk-textarea"
            name="topic"
            aria-label="What are you working on?"
            maxLength={2000}
            placeholder="A sentence or two is plenty."
            value={p.topic}
            onChange={(e) => p.setTopic(e.target.value)}
          />
        </div>
        <label aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
          <span>website</span>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={p.website} onChange={(e) => p.setWebsite(e.target.value)} />
        </label>
        <div>
          <button
            type="submit"
            className="bk-cta"
            aria-disabled={!valid || p.busy}
            style={!valid || p.busy ? { opacity: 0.45, cursor: 'not-allowed', width: '100%' } : { width: '100%' }}
          >
            Book my free hour
          </button>
          <div style={{ marginTop: 8, textAlign: 'center', font: '400 12.5px var(--bk-sans)', color: 'var(--bk-muted)' }}>
            Free · No card needed · No strings attached
          </div>
        </div>
        <Notice msg={p.msg} />
      </form>
    </>
  );
}

interface DoneProps {
  booked: Booked;
  pv: SlotView;
  busy: boolean;
  onReschedule: () => void;
  onCancel: () => void;
}

export function DoneStep({ booked, pv, busy, onReschedule, onCancel }: DoneProps) {
  const [icsUrl, setIcsUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([booked.ics], { type: 'text/calendar' }));
    setIcsUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [booked.ics]);

  const cal = {
    title: 'Free hour with Bilko Bibitkov',
    startMs: booked.startMs,
    endMs: booked.endMs,
    details: 'Bilko will email the video link before the session.',
  };
  const NEXT = [
    'Check your inbox for the invite. The video link follows before the call.',
    'Bring whatever you have: an idea, a repo, a bug.',
    "Afterwards I'll send a short plan with an honest hours estimate. Nothing starts until you say yes.",
  ];
  return (
    <>
      <h2 style={{ marginTop: 20 }}>You're booked.</h2>
      <p style={{ margin: '8px 0 0', font: '600 15px var(--bk-sans)' }}>
        {pv.dateLong} · {pv.time} – {pv.timeEnd} {pv.tzAbbr}
      </p>
      <p style={{ margin: '8px 0 0', font: '400 14px/1.5 var(--bk-sans)', color: 'var(--bk-body)' }}>
        A confirmation with a calendar invite is on its way to {booked.email}. Bilko will send the video link before the session.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        <a className="bk-btn-secondary" href={googleCalendarUrl(cal)} target="_blank" rel="noopener noreferrer">Google Calendar</a>
        {icsUrl && <a className="bk-btn-secondary" href={icsUrl} download="bilko-free-hour.ics">Apple Calendar</a>}
        <a className="bk-btn-secondary" href={outlookCalendarUrl(cal)} target="_blank" rel="noopener noreferrer">Outlook</a>
      </div>
      <div className="bk-group-label" style={{ margin: '22px 0 10px' }}>What happens next</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {NEXT.map((t, i) => (
          <div key={t} className="bk-next"><span>0{i + 1}</span><span>{t}</span></div>
        ))}
      </div>
      <div className="bk-foot" style={{ marginTop: 22 }}>
        <div>
          Need a different time?{' '}
          <button type="button" className="bk-link" disabled={busy} onClick={onReschedule}>Reschedule</button>
          {' · '}
          <button type="button" className="bk-link" disabled={busy} onClick={onCancel}>Cancel booking</button>
        </div>
      </div>
    </>
  );
}
