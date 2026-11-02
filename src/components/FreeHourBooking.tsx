import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../constants.js';
import { trackFlow } from '../lib/telemetry.js';
import { BILKO_CONTACT_EMAIL } from '../../shared/bilko-profile.js';

interface Slot { startMs: number; endMs: number }
interface Booked { startMs: number; emailed: boolean; ics: string; cancelToken: string; email: string }

const FMT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});
const label = (ms: number) => FMT.format(new Date(ms));
const BASE = `${API_BASE}/services/human-for-hire`;

function Mail() {
  return <a href={`mailto:${BILKO_CONTACT_EMAIL}`}>{BILKO_CONTACT_EMAIL}</a>;
}

type Msg = 'already_booked' | 'slot_unavailable' | 'rate' | 'down' | 'invalid' | 'cancelled' | null;

export function FreeHourBooking() {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [booked, setBooked] = useState<Booked | null>(null);
  const [icsUrl, setIcsUrl] = useState<string | null>(null);

  const load = useCallback(() => {
    setSlots(null);
    setLoadError(false);
    fetch(`${BASE}/slots`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('slots'))))
      .then((s: { slots: Slot[] }) => setSlots(s.slots ?? []))
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!booked) { setIcsUrl(null); return; }
    const url = URL.createObjectURL(new Blob([booked.ics], { type: 'text/calendar' }));
    setIcsUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [booked]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (startMs === null || !email.trim()) return;
    setBusy(true);
    setMsg(null);
    trackFlow('hire', 'book-free-hour');
    try {
      const res = await fetch(`${BASE}/free-hour`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), startMs, topic: topic.trim(), website }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string; booking?: { startMs: number }; emailed?: boolean; ics?: string; cancelToken?: string;
      };
      if (res.status === 201 && data.booking) {
        trackFlow('hire', 'booked');
        setBooked({
          startMs: data.booking.startMs,
          emailed: data.emailed !== false,
          ics: data.ics ?? '',
          cancelToken: data.cancelToken ?? '',
          email: email.trim(),
        });
      } else if (res.status === 409 && data.error === 'already_booked') {
        setMsg('already_booked');
      } else if (res.status === 409) {
        setMsg('slot_unavailable');
        setStartMs(null);
        load();
      } else if (res.status === 429) {
        setMsg('rate');
      } else if (res.status === 400) {
        setMsg('invalid');
      } else {
        setMsg('down');
      }
    } catch {
      setMsg('down');
    }
    setBusy(false);
  }

  async function cancel() {
    if (!booked) return;
    setBusy(true);
    try {
      await fetch(`${BASE}/free-hour/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: booked.cancelToken }),
      });
    } catch { /* reload below shows the real state */ }
    setBooked(null);
    setStartMs(null);
    setMsg('cancelled');
    setBusy(false);
    load();
  }

  let notice: React.ReactNode = null;
  switch (msg) {
    case 'already_booked':
      notice = <>You've already booked your free hour with this email. Check your inbox for the invite, or write to <Mail /> to change it.</>; break;
    case 'slot_unavailable': notice = <>That time was just taken. Pick another.</>; break;
    case 'rate': notice = <>Too many tries. Please try again in an hour.</>; break;
    case 'down': notice = <>Booking isn't working right now. Write to <Mail /> and we'll set it up by hand.</>; break;
    case 'invalid': notice = <>Check your email address and try again.</>; break;
    case 'cancelled': notice = <>Cancelled. Pick another time whenever you're ready.</>; break;
  }

  return (
    <section className="free-hour-booking" id="book">
      <div className="card">
        <h2>Book your free hour</h2>
        {booked ? (
          <div role="status">
            <p>
              {booked.emailed
                ? <>You're booked: {label(booked.startMs)}. A calendar invite is on its way to {booked.email}.</>
                : <>You're booked: {label(booked.startMs)}, but the invite email didn't send. Download it here, and write to <Mail /> if anything looks wrong.</>}
            </p>
            <div className="btns">
              {icsUrl && <a className="btn primary" href={icsUrl} download="bilko-free-hour.ics">Add to calendar</a>}
              <button type="button" className="btn" disabled={busy} onClick={() => void cancel()}>Cancel this booking</button>
            </div>
          </div>
        ) : (
          <form onSubmit={e => void submit(e)}>
            {loadError && <p className="small">We couldn't load the open times. Try again shortly, or write to <Mail />.</p>}
            {!slots && !loadError && <p className="small">Loading open times…</p>}
            {slots && slots.length === 0 && <p className="small">No open times right now. Write to <Mail /> and we'll find one.</p>}
            <div className="fhb-slots">
              {slots?.map(s => (
                <button
                  key={s.startMs}
                  type="button"
                  className={`btn${startMs === s.startMs ? ' primary' : ''}`}
                  aria-pressed={startMs === s.startMs}
                  onClick={() => { setStartMs(s.startMs); trackFlow('hire', 'pick-slot'); }}
                >
                  {label(s.startMs)}
                </button>
              ))}
            </div>
            <label className="fhb-field">
              <span>Email</span>
              <input type="email" name="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <label className="fhb-field">
              <span>What are you working on?</span>
              <textarea name="topic" rows={3} maxLength={2000} value={topic} onChange={e => setTopic(e.target.value)} />
            </label>
            <label className="fhb-hp" aria-hidden="true">
              <span>website</span>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
            </label>
            <button type="submit" className="btn primary" disabled={busy || startMs === null || !email.trim()}>Book my free hour</button>
            {notice && <p className="small" role="alert">{notice}</p>}
          </form>
        )}
      </div>
    </section>
  );
}
