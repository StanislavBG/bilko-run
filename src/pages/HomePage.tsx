import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticker } from '../components/portfolio/Ticker.js';
import { navigateProject } from '../components/portfolio/navigateProject.js';
import { SECTIONS, PORTFOLIO_PROJECTS, NOW_ITEMS } from '../data/portfolio.js';

export function HomePage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Bilko Bibitkov — AI builder, regular human';
  }, []);

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="pf-page">
      <section className="pf-hero">
        <div>
          <h1>
            <span style={{ display: 'block' }}>I build <span className="pf-accent">AI things</span></span>
            <span style={{ display: 'block' }}>for <span className="pf-strike">enterprises</span> humans.</span>
          </h1>
          <div className="pf-who">
            <span>Sofia · Studio of one</span>
            <span className="pf-line"></span>
            <span>est. 2024</span>
          </div>
          <p className="pf-blurb">
            Hey, I'm Bilko. I believe in people — stubbornly, loudly, sometimes
            embarrassingly. My dream is simple: make AI feel like a buddy that
            has your back, not a black box that talks down to you. I'll try a
            hundred ideas, fail at ninety, laugh at most of them, and ship the
            ten that actually help someone's day.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
            <button className="pf-btn" onClick={() => navigate('/projects')}>See the work →</button>
            <button className="pf-btn ghost" onClick={() => navigate('/contact')}>Get in touch</button>
          </div>
        </div>
        <div className="pf-hero-side">
          <div className="pf-portrait-card">
            <div className="pf-portrait">
              <svg viewBox="0 0 200 220" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <pattern id="pf-hero-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="200" height="220" fill="var(--pf-accent)" />
                <rect width="200" height="220" fill="url(#pf-hero-grid)" />
                {/* orbiting dots */}
                <g style={{ transformOrigin: '100px 110px' }}>
                  <circle cx="100" cy="40" r="4" fill="var(--pf-ink)">
                    <animateTransform attributeName="transform" type="rotate" from="0 100 110" to="360 100 110" dur="14s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="100" cy="60" r="2.5" fill="var(--pf-ink)" opacity="0.5">
                    <animateTransform attributeName="transform" type="rotate" from="120 100 110" to="480 100 110" dur="22s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="100" cy="20" r="3" fill="var(--pf-bg)">
                    <animateTransform attributeName="transform" type="rotate" from="240 100 110" to="-120 100 110" dur="30s" repeatCount="indefinite" />
                  </circle>
                </g>
                {/* center monogram */}
                <circle cx="100" cy="110" r="44" fill="var(--pf-ink)" />
                <circle cx="100" cy="110" r="50" fill="none" stroke="var(--pf-ink)" strokeWidth="1" strokeDasharray="2 4" />
                <text x="100" y="124" textAnchor="middle" fontFamily="var(--pf-font-display)" fontSize="56" fill="var(--pf-bg)" fontStyle="italic">B</text>
                {/* signal line */}
                <g stroke="var(--pf-ink)" strokeWidth="1.2" fill="none">
                  <path d="M 20 180 L 60 180 L 70 170 L 90 190 L 110 175 L 130 185 L 180 180" opacity="0.6">
                    <animate
                      attributeName="d"
                      values="M 20 180 L 60 180 L 70 170 L 90 190 L 110 175 L 130 185 L 180 180;
                              M 20 180 L 60 175 L 70 188 L 90 172 L 110 190 L 130 178 L 180 180;
                              M 20 180 L 60 180 L 70 170 L 90 190 L 110 175 L 130 185 L 180 180"
                      dur="6s"
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
                {/* corner ticks */}
                <g stroke="var(--pf-ink)" strokeWidth="1.5" opacity="0.5">
                  <path d="M 12 12 L 22 12 M 12 12 L 12 22" />
                  <path d="M 188 12 L 178 12 M 188 12 L 188 22" />
                  <path d="M 12 208 L 22 208 M 12 208 L 12 198" />
                  <path d="M 188 208 L 178 208 M 188 208 L 188 198" />
                </g>
              </svg>
            </div>
            <div className="pf-portrait-meta">
              <div className="pf-mono" style={{ color: 'var(--pf-ink-3)' }}>Bilko Bibitkov</div>
              <div className="pf-serif" style={{ fontSize: 22, lineHeight: 1.1, marginTop: 4 }}>
                <em style={{ color: 'var(--pf-accent)' }}>Stubborn optimist.</em><br />
                Builder of small useful things.
              </div>
            </div>
          </div>
          <div className="pf-now">
            <div className="pf-now-label">
              <span className="pf-status-dot"></span>
              <span className="pf-mono" style={{ color: 'var(--pf-ink)' }}>Currently · {today}</span>
            </div>
            <ul>
              {NOW_ITEMS.slice(0, 4).map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <Ticker />

      <section style={{ padding: '56px 0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 24 }}>
          <div>
            <div className="pf-eyebrow">Index · {SECTIONS.length} sections</div>
            <h2 className="pf-serif" style={{ fontSize: 48, margin: '8px 0 0', fontWeight: 400, letterSpacing: '-0.015em' }}>
              Pick a room.
            </h2>
          </div>
          <div className="pf-mono" style={{ maxWidth: 280, color: 'var(--pf-ink-2)', textTransform: 'none', letterSpacing: 0, fontSize: 12, lineHeight: 1.5 }}>
            Every page tells you what it is, why it exists, and what to do next.
            Press <span style={{ color: 'var(--pf-ink)', fontWeight: 600 }}>⌘K</span> to jump anywhere.
          </div>
        </div>
        <div className="pf-section-grid">
          {SECTIONS.map((s, i) => (
            <div key={s.id} className="pf-section-tile" onClick={() => navigate(s.path)}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="pf-tile-num">0{i + 1} / 0{SECTIONS.length}</span>
                <span className="pf-tile-arrow">↗</span>
              </div>
              <span className="pf-tile-icon">{s.icon}</span>
              <h3>{s.label}</h3>
              <p>{s.desc}</p>
              <div className="pf-tile-foot">
                <span>{s.tag}</span>
                <span>{s.path}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '56px 0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
          <h2 className="pf-serif" style={{ fontSize: 48, margin: 0, fontWeight: 400, letterSpacing: '-0.015em' }}>
            Recent <em style={{ color: 'var(--pf-accent)', fontStyle: 'italic' }}>builds.</em>
          </h2>
          <a className="pf-mono" onClick={() => navigate('/projects')} style={{ cursor: 'pointer', color: 'var(--pf-ink)' }}>
            All projects →
          </a>
        </div>
        <div className="pf-proj-grid">
          {PORTFOLIO_PROJECTS.slice(0, 4).map((p, i) => (
            <div key={p.id} className="pf-proj-card" onClick={() => navigateProject(navigate, p)}>
              <div className={`pf-swatch ${p.color}`}></div>
              <div className="pf-head">
                <span className="pf-ord">No. 0{i + 1}</span>
                <span className="pf-ord">{p.year}</span>
              </div>
              <div className="pf-kind">{p.kind}</div>
              <h3>{p.name}</h3>
              <p className="pf-blurb">{p.blurb}</p>
              <div className="pf-foot">
                <span className={`pf-status ${p.status.toLowerCase()}`}>{p.status}</span>
                {p.tags.map(t => <span key={t} className="pf-chip">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
