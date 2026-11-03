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
    return all.sort((a, b) => a.startMs - b.startMs);
  }, [open, taken]);

  const firstMs = items.length ? items[0].startMs : nowMs;
  const options = useMemo(() => timeZoneOptions(firstMs, detected, tz), [firstMs, detected, tz]);
  const groups = useMemo(() => groupByWeek(items, tz, nowMs), [items, tz, nowMs]);
  const note = open && open.length ? hostNote(firstMs, tz) : null;

  const picked = pickedMs === null ? null : items.find((s) => s.startMs === pickedMs && !s.taken) ?? null;
  const pv = picked ? slotView(picked.startMs, picked.endMs, tz, nowMs) : null;

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
              <h2 style={{ marginTop: 20 }}>Pick a time</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <label htmlFor="bk-tz" style={{ font: '500 12.5px var(--bk-sans)', color: 'var(--bk-muted)' }}>Times in</label>
                <select id="bk-tz" className="bk-select" value={tz} onChange={(e) => setTz(e.target.value)}>
                  {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {note && <p style={{ margin: '8px 0 0', font: '400 12.5px var(--bk-sans)', color: 'var(--bk-muted)' }}>{note}</p>}

              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {loadError && (
                  <div role="alert">
                    <p style={{ margin: '0 0 10px' }}>We couldn't load the open times. Try again shortly, or write to {mail}.</p>
                    <button type="button" className="bk-btn-secondary" onClick={load}>Retry</button>
                  </div>
                )}
                {!open && !loadError && <p style={{ margin: 0 }}>Loading open times…</p>}
                {open && open.length === 0 && <p style={{ margin: 0 }}>No open times right now. Write to {mail} and we'll find one.</p>}
                {open && open.length > 0 && groups.map((g) => (
                  <div key={g.label}>
                    <div className="bk-group-label" style={{ marginBottom: 8 }}>{g.label}</div>
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

              <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--bk-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ font: '500 13.5px/1.4 var(--bk-sans)', color: 'var(--bk-body)', minWidth: 0 }}>
                  {pv ? `${pv.dateLong} · ${pv.time} – ${pv.timeEnd} ${pv.tzAbbr} · Video call` : 'Choose a time to continue'}
                </div>
                <button
                  type="button"
                  className="bk-cta"
                  aria-disabled={!picked}
                  style={!picked ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                  onClick={() => {
                    if (!picked) return;
                    trackFlow('hire', 'continue');
                    setStep(1);
                  }}
                >
                  Continue →
                </button>
              </div>
            </>
          ) : (
            pv && (
              <>
                <h2 style={{ marginTop: 20 }}>Your details</h2>
                <div className="bk-summary" style={{ marginTop: 16 }}>
                  <div className="bk-leaf"><small>{pv.mon}</small>{pv.day}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 15px var(--bk-sans)' }}>{pv.dateLong}</div>
                    <div style={{ font: '400 13.5px var(--bk-sans)', color: 'var(--bk-body)' }}>{pv.time} – {pv.timeEnd} {pv.tzAbbr} · Video call</div>
                  </div>
                  <button type="button" className="bk-link" onClick={() => setStep(0)}>Change</button>
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
