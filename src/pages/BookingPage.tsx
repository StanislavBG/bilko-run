import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../constants.js';
import { trackFlow } from '../lib/telemetry.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { BILKO_CONTACT_EMAIL } from '../../shared/bilko-profile.js';
import { BOOKING_PAGE_LEFT_HTML, BOOKING_PAGE_TITLE } from '../../shared/booking-page.js';
import {
  detectTimeZone,
  groupByWeek,
  hostNote,
  slotView,
  timeZoneOptions,
} from '../lib/bookingView.js';
import { DetailsStep, DoneStep, Notice, type Booked, type Msg } from './BookingSteps.js';

interface Slot { startMs: number; endMs: number }
interface SlotItem extends Slot { taken: boolean }

const BASE = `${API_BASE}/services/human-for-hire`;
const STEPS = ['Time', 'Details', 'Done'];

function Stepper({ active }: { active: number }) {
  return (
    <ol className="bk-steps" aria-label="Booking steps">
      {STEPS.map((name, i) => {
        const state = i < active ? 'done' : i === active ? 'active' : 'todo';
        return (
          <li key={name} className={state} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="bk-n">{state === 'done' ? '✓' : i + 1}</span>
            {name}
          </li>
        );
      })}
    </ol>
  );
}

export function BookingPage() {
  useDocumentTitle(BOOKING_PAGE_TITLE);
  const [open, setOpen] = useState<Slot[] | null>(null);
  const [taken, setTaken] = useState<Slot[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [pickedMs, setPickedMs] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const detected = useMemo(() => detectTimeZone(), []);
  const [tz, setTz] = useState(detected);
  const [nowMs] = useState(() => Date.now());
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  const load = useCallback(() => {
    setOpen(null);
    setLoadError(false);
    fetch(`${BASE}/slots`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('slots'))))
      .then((d: { slots?: Slot[]; taken?: Slot[] }) => {
        setOpen(d.slots ?? []);
        setTaken(d.taken ?? []);
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const items: SlotItem[] = useMemo(() => {
    const all = [
      ...(open ?? []).map((s) => ({ ...s, taken: false })),
      ...taken.map((s) => ({ ...s, taken: true })),
    ];
    return all
      .filter((s) => !(rescheduling && booked && s.startMs === booked.startMs))
      .sort((a, b) => a.startMs - b.startMs);
  }, [open, taken, rescheduling, booked]);

  const firstMs = items.length ? items[0].startMs : nowMs;
  const options = useMemo(() => timeZoneOptions(firstMs, detected, tz), [firstMs, detected, tz]);
  const groups = useMemo(() => groupByWeek(items, tz, nowMs), [items, tz, nowMs]);
  const note = open && open.length ? hostNote(firstMs, tz) : null;

  const picked = pickedMs === null ? null : items.find((s) => s.startMs === pickedMs && !s.taken) ?? null;
  const pv = picked ? slotView(picked.startMs, picked.endMs, tz, nowMs) : null;

  const bv = booked ? slotView(booked.startMs, booked.endMs, tz, nowMs) : null;

  async function post(path: string, body: object) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string; booking?: { startMs: number; endMs?: number }; ics?: string; cancelToken?: string;
    };
    return { res, data };
  }

  async function book() {
    if (!picked) return;
    setBusy(true);
    setMsg(null);
    trackFlow('hire', 'book-free-hour');
    try {
      const { res, data } = await post('/free-hour', {
        email: email.trim(), startMs: picked.startMs, topic: topic.trim(), tags, website,
      });
      if (res.status === 201 && data.booking) {
        trackFlow('hire', 'booked');
        setBooked({
          startMs: data.booking.startMs,
          endMs: data.booking.endMs ?? picked.endMs,
          ics: data.ics ?? '',
          token: data.cancelToken ?? '',
          email: email.trim(),
        });
        setStep(2);
      } else if (res.status === 409 && data.error === 'already_booked') {
        setMsg('already_booked');
      } else if (res.status === 409) {
        setMsg('slot_unavailable');
        setPickedMs(null);
        setStep(0);
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

  async function reschedule() {
    if (!picked || !booked) return;
    setBusy(true);
    setMsg(null);
    try {
      const { res, data } = await post('/free-hour/reschedule', { token: booked.token, startMs: picked.startMs });
      if (res.status === 200 && data.booking) {
        setBooked({
          ...booked,
          startMs: data.booking.startMs,
          endMs: data.booking.endMs ?? picked.endMs,
          ics: data.ics ?? booked.ics,
          token: data.cancelToken ?? booked.token,
        });
        setRescheduling(false);
        setPickedMs(null);
        setStep(2);
      } else if (res.status === 409) {
        setMsg('slot_unavailable');
        setPickedMs(null);
        load();
      } else if (res.status === 429) {
        setMsg('rate');
      } else {
        setMsg('reschedule_failed');
      }
    } catch {
      setMsg('reschedule_failed');
    }
    setBusy(false);
  }

  async function cancel() {
    if (!booked) return;
    setBusy(true);
    try {
      await post('/free-hour/cancel', { token: booked.token });
    } catch { /* reload below shows the real state */ }
    setBooked(null);
    setRescheduling(false);
    setPickedMs(null);
    setStep(0);
    setMsg('cancelled');
    setBusy(false);
    load();
  }

  const mail = (
    <a href={`mailto:${BILKO_CONTACT_EMAIL}`}>{BILKO_CONTACT_EMAIL}</a>
  );

  return (
    <div className="booking-page">
      <div className="bk-inner">
        {/* Trusted constant from shared/booking-page.ts; no user input. */}
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: BOOKING_PAGE_LEFT_HTML }} />
        <div className="bk-card">
          <Stepper active={step} />
          {step === 0 ? (
            <>
              <div className="bk-body">
              <div className="bk-head">
                <h2>Pick a time</h2>
                <label className="bk-tz" htmlFor="bk-tz">
                  Times in
                  <select id="bk-tz" className="bk-select" value={tz} onChange={(e) => setTz(e.target.value)}>
                    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              </div>
              <Notice msg={msg} />
              {note && <p className="bk-host-note">{note}</p>}

              <div className="bk-groups">
                {loadError && (
                  <div role="alert">
                    <p style={{ margin: '0 0 10px' }}>We couldn't load the open times. Try again shortly, or write to {mail}.</p>
                    <button type="button" className="bk-btn-secondary" onClick={load}>Retry</button>
                  </div>
                )}
                {!open && !loadError && <p style={{ margin: 0 }}>Loading open times…</p>}
                {open && open.length === 0 && <p style={{ margin: 0 }}>No open times right now. Write to {mail} and we'll find one.</p>}
                {open && open.length > 0 && groups.map((g) => (
                  <div key={g.label} className="bk-group">
                    <div className="bk-group-label">{g.label}</div>
                    <div className="bk-grid">
                      {g.slots.map((s) => {
                        const v = slotView(s.startMs, s.endMs, tz, nowMs);
                        if (s.taken) {
                          return (
                            <div key={s.startMs} className="bk-slot taken">
                              <div className="bk-slot-top"><span className="bk-wd">{v.wd}</span><span className="bk-badge">Taken</span></div>
                              <div className="bk-slot-bottom"><span className="bk-date">{v.mon} {v.day}</span><span className="bk-time">{v.time}</span></div>
                            </div>
                          );
                        }
                        const on = pickedMs === s.startMs;
                        return (
                          <button
                            key={s.startMs}
                            type="button"
                            className="bk-slot"
                            aria-pressed={on}
                            onClick={() => { setPickedMs(s.startMs); trackFlow('hire', 'pick-slot'); }}
                          >
                            <span className="bk-slot-top">
                              <span className="bk-wd">{v.wd}</span>
                              {on ? <span className="bk-badge">✓ Selected</span> : v.tomorrow ? <span className="bk-badge">Tomorrow</span> : null}
                            </span>
                            <span className="bk-slot-bottom">
                              <span className="bk-date">{v.mon} {v.day}</span>
                              <span className="bk-time">{v.time}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bk-step-foot">
                {pv ? (
                  <div className="bk-pick">
                    <span className="bk-pick-date">{pv.dateLong}</span>
                    <span className="bk-pick-time">{`${pv.time} – ${pv.timeEnd} ${pv.tzAbbr} · Video call`}</span>
                  </div>
                ) : (
                  <div className="bk-pick-none">Choose a time to continue</div>
                )}
                <button
                  type="button"
                  className="bk-cta bk-cta-sm"
                  aria-disabled={!picked}
                  onClick={() => {
                    if (!picked) return;
                    trackFlow('hire', 'continue');
                    if (rescheduling) { void reschedule(); return; }
                    setMsg(null);
                    setStep(1);
                  }}
                >
                  Continue →
                </button>
              </div>
              </div>
            </>
          ) : step === 1 ? (
            pv && (
              <DetailsStep
                pv={pv}
                email={email}
                setEmail={setEmail}
                topic={topic}
                setTopic={setTopic}
                tags={tags}
                toggleTag={(t) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
                website={website}
                setWebsite={setWebsite}
                busy={busy}
                msg={msg}
                onChange={() => { setMsg(null); setStep(0); }}
                onSubmit={() => void book()}
              />
            )
          ) : (
            booked && bv && (
              <DoneStep
                booked={booked}
                pv={bv}
                busy={busy}
                onReschedule={() => { setMsg(null); setRescheduling(true); setPickedMs(null); setStep(0); load(); }}
                onCancel={() => void cancel()}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
