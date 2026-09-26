import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ManualToc } from '../../../shared/manual-catalog.js';
import { COPY, fill, type LandingTab } from './copy.js';
import { nextTabIndex, partNumber, type LayoutModeName } from './layout.js';

export const TABS: readonly LandingTab[] = COPY.tabs;

type TocChapter = ManualToc['chapters'][number];

/** Where a tab's "Read this chapter" link goes, given what the live TOC says. */
const warnedSlugs = new Set<string>();

export function chapterHref(slug: string, toc: ManualToc | null): string {
  // The reader silently opens chapter 1 for an unknown #slug, so once the TOC
  // has loaded and lacks the slug, link to the bare manual instead of lying.
  // tests/session-manager-landing.test.ts keeps this branch unreachable.
  if (toc && !toc.chapters.some(c => c.slug === slug)) {
    if (!warnedSlugs.has(slug)) {
      warnedSlugs.add(slug);
      console.warn(`[session-manager] Field Manual has no chapter "${slug}"; linking to the manual root.`);
    }
    return COPY.meta.manualHref;
  }
  return fill(COPY.meta.chapterHrefTemplate, { slug });
}

function ChapterCard({ tab, toc }: { tab: LandingTab; toc: ManualToc | null }) {
  const live: TocChapter | undefined = toc?.chapters.find(c => c.slug === tab.chapter.slug);
  const title = live?.title ?? tab.chapter.title;
  // No TOC (loading or failed) renders the free wording — true under the ship
  // gate. Only an explicit `free: false` from the live manual turns it off.
  const free = live ? live.free : true;
  const aside = COPY.partsBin.aside;
  const label = fill(free ? COPY.partsBin.aria.chapterLinkTemplate : COPY.partsBin.aria.chapterLinkNotFreeTemplate, { title });
  return (
    <aside className="smlp-chapter" aria-labelledby="smlp-chapter-label">
      <span className="smlp-chapter__tape" aria-hidden="true" />
      <div className="smlp-chapter__labels">
        <span id="smlp-chapter-label" className="smlp-chapter__label">{aside.label}</span>
        {free && <span className="smlp-chapter__free">{aside.freeChip}</span>}
      </div>
      <p className="smlp-chapter__title">{title}</p>
      <div className="smlp-chapter__rule" aria-hidden="true" />
      <ul className="smlp-chapter__points">
        {tab.chapter.points.map(point => (
          <li key={point}>
            <span className="smlp-chapter__star" aria-hidden="true">✦</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <a className="smlp-chapter__link" href={chapterHref(tab.chapter.slug, toc)} aria-label={label}>
        {free ? aside.link : aside.linkNotFree}
      </a>
    </aside>
  );
}

/**
 * The Parts Bin: nine numbered tabs that swap the panel in place.
 *
 * A real ARIA tablist (the mock had none): roving tabindex, arrow keys on both
 * axes in both layouts (wrapping), Home/End, automatic activation.
 */
export function PartsBin({ mode, toc }: { mode: LayoutModeName; toc: ManualToc | null }) {
  const [index, setIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const tab = TABS[index];
  const num = partNumber(index);

  // Reflow on a narrow column shows the tabs as one scrolling row with a fade
  // at the right edge. The fade alone is no cue at the widths where a tab
  // boundary falls right at the fade (the next tab sits wholly inside it and
  // the row reads as complete), and overlay scrollbars show nothing until you
  // scroll. So the rail also carries `data-more` while any tab lies past the
  // right edge, which the stylesheet turns into a chevron. On a wide column
  // the tabs wrap instead and this stays off (nothing overflows).
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = listRef.current;
    if (mode !== 'reflow' || !el) {
      setMore(false);
      return;
    }
    const update = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    update();
    el.addEventListener('scroll', update, { passive: true });
    // The row's own box, and every tab: web fonts landing widen the tabs
    // without resizing the row.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
      for (const t of tabRefs.current) if (t) ro.observe(t);
    }
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [mode]);

  const select = (i: number, focus: boolean) => {
    setIndex(i);
    const el = tabRefs.current[i];
    if (!el) return;
    const reflow = mode === 'reflow';
    // In reflow the tabs are one scrollable row below 600px (from there up
    // they wrap, and the scroll below only brings a half-hidden tab into
    // view); the scroll places the tab, so focusing must not scroll it first.
    if (focus) el.focus({ preventScroll: reflow });
    if (reflow) {
      // Centre the chosen tab in the row. 'nearest' left it flush with an edge
      // — under the right-edge fade — and the row's proximity snap (also
      // centre-aligned, see the stylesheet) could pull it back out of view.
      try {
        el.scrollIntoView({ block: 'nearest', inline: 'center' });
      } catch { /* old engines: selection still works */ }
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = nextTabIndex(e.key, index, TABS.length);
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  };

  return (
    <section className="smlp-bin" aria-labelledby="smlp-bin-heading">
      <div className="smlp-bin__tabs">
        <div className="smlp-bin__head">
          <h2 id="smlp-bin-heading" className="smlp-bin__label">{COPY.partsBin.label}</h2>
          <p className="smlp-bin__hint">{COPY.partsBin.hint}</p>
        </div>
        <div className="smlp-bin__rail" data-more={more || undefined}>
          <div
            ref={listRef}
            role="tablist"
            aria-label={COPY.partsBin.aria.tablist}
            aria-orientation={mode === 'canvas' ? 'vertical' : 'horizontal'}
            className="smlp-bin__tablist"
            onKeyDown={onKeyDown}
          >
            {TABS.map((t, i) => {
              const on = i === index;
              return (
                <button
                  key={t.key}
                  ref={el => { tabRefs.current[i] = el; }}
                  type="button"
                  role="tab"
                  id={`smlp-tab-${t.key}`}
                  aria-controls="smlp-panel"
                  aria-selected={on}
                  tabIndex={on ? 0 : -1}
                  className={on ? 'smlp-tab smlp-tab--on' : 'smlp-tab'}
                  data-tab={t.key}
                  onClick={() => select(i, false)}
                >
                  <span className="smlp-tab__num" aria-hidden="true">{partNumber(i)}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        role="tabpanel"
        id="smlp-panel"
        aria-labelledby={`smlp-tab-${tab.key}`}
        tabIndex={0}
        className="smlp-panel"
      >
        <div className="smlp-panel__ghost" aria-hidden="true">{num}</div>
        <p className="smlp-panel__kicker">
          {fill(COPY.partsBin.kickerTemplate, { nn: num, LABEL: tab.label.toUpperCase() })}
        </p>
        <h3 className="smlp-panel__title">{tab.title}</h3>
        <p className="smlp-panel__body">{tab.body}</p>
        <ul className="smlp-panel__bullets">
          {tab.bullets.map(b => (
            <li key={b}>
              <span className="smlp-panel__plus" aria-hidden="true">+</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <ChapterCard tab={tab} toc={toc} />
    </section>
  );
}
