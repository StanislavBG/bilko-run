/**
 * MetricsView — operator analytics dashboard
 *
 * Shows: funnel conversion, CLI telemetry, web tool usage, npm/GitHub traffic.
 * Reads from /api/analytics/summary and /api/analytics/npm-stats.
 * Operator-only — not linked from the public nav, accessed at /metrics.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { API } from '../data/api.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyticsSummary {
  period: { from: string; to: string };
  funnel: {
    events: Record<string, number>;
    conversion_rate_pct: number;
    free_limit_hits_30d: number;
    upgrade_clicks_30d: number;
    checkout_completions_30d: number;
  };
  cli: {
    unique_installs_30d: number;
    total_commands_30d: number;
    success_rate_pct: number;
    avg_duration_ms: number | null;
    command_breakdown: { command: string; count: number; avg_ms: number }[];
  };
  web: {
    tool_usage_7d: { endpoint: string; total: number }[];
    tool_usage_30d: { endpoint: string; total: number }[];
    daily_active_users_7d: { date: string; unique_ips: number; requests: number }[];
    today: { total_requests: number; unique_ips: number };
  };
  leads: { email_captures_30d: number; unique_emails_30d: number };
  generated_at: string;
}

interface NpmStats {
  latest: {
    timestamp: string;
    npm?: {
      package: string;
      last_week: number;
      last_month: number;
      last_year: number;
      status?: string;
    };
    github?: {
      repo: string;
      engagement: { stars: number; forks: number; watchers: number; open_issues: number };
      clones: { count_14d: number; uniques_14d: number };
      views: { count_14d: number; uniques_14d: number };
      top_referrers: { referrer: string; count: number; uniques: number }[];
    };
  };
  snapshot_count: number;
  oldest_snapshot: string | null;
  newest_snapshot: string | null;
}

// ── Tiny UI components ────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#0d0d1a',
      border: '1px solid #12121f',
      borderRadius: 12,
      padding: '16px 20px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, color: '#444',
      textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'monospace',
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, color = '#e0e0e0' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#444', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'monospace', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: '#333', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#888' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#ccc', fontFamily: 'monospace' }}>
          {value.toLocaleString()} <span style={{ color: '#444' }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height: 5, background: '#1a1a2e', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function MetricsView() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [npmStats, setNpmStats] = useState<NpmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, npmRes] = await Promise.all([
        fetch(`${API}/analytics/summary`),
        fetch(`${API}/analytics/npm-stats`),
      ]);

      if (!summaryRes.ok) throw new Error(`Analytics summary: ${summaryRes.status}`);
      const summaryData = await summaryRes.json() as AnalyticsSummary;
      setSummary(summaryData);

      if (npmRes.ok && npmRes.status !== 204) {
        const npmData = await npmRes.json() as NpmStats;
        setNpmStats(npmData);
      }

      setLastRefresh(new Date());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#333', fontSize: 12 }}>
        Loading metrics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#ef5350', fontSize: 13, marginBottom: 8 }}>Failed to load metrics</div>
        <div style={{ color: '#444', fontSize: 11, fontFamily: 'monospace' }}>{error}</div>
        <button onClick={load} style={{
          marginTop: 16, padding: '8px 20px', background: '#1a1a2e',
          color: '#7c4dff', border: '1px solid #7c4dff44', borderRadius: 8,
          cursor: 'pointer', fontSize: 12, fontWeight: 700,
        }}>
          Retry
        </button>
      </div>
    );
  }

  const funnelMax = summary?.funnel.free_limit_hits_30d ?? 0;
  const npm = npmStats?.latest?.npm;
  const github = npmStats?.latest?.github;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#e0e0e0' }}>Metrics</div>
          <div style={{ fontSize: 11, color: '#333', marginTop: 2 }}>
            {summary && `Last 30 days · ${summary.period.from} → ${summary.period.to}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastRefresh && (
            <span style={{ fontSize: 10, color: '#333' }}>
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={load}
            style={{
              padding: '6px 14px', background: '#12121f', color: '#7c4dff',
              border: '1px solid #7c4dff33', borderRadius: 7, cursor: 'pointer',
              fontSize: 11, fontWeight: 700,
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Funnel overview */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Conversion Funnel — 30d</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
          <Stat
            label="Free limit hits"
            value={(summary?.funnel.free_limit_hits_30d ?? 0).toLocaleString()}
            sub="users reached paywall"
            color="#ffd54f"
          />
          <Stat
            label="Upgrade clicks"
            value={(summary?.funnel.upgrade_clicks_30d ?? 0).toLocaleString()}
            sub="clicked Pro CTA"
            color="#7c4dff"
          />
          <Stat
            label="Checkouts completed"
            value={(summary?.funnel.checkout_completions_30d ?? 0).toLocaleString()}
            sub="paid customers"
            color="#4caf50"
          />
          <Stat
            label="Conversion rate"
            value={`${summary?.funnel.conversion_rate_pct ?? 0}%`}
            sub="upgrade click → paid"
            color={
              (summary?.funnel.conversion_rate_pct ?? 0) >= 5 ? '#4caf50' :
              (summary?.funnel.conversion_rate_pct ?? 0) >= 2 ? '#ffd54f' : '#ef5350'
            }
          />
        </div>
        <FunnelBar label="Free limit hit" value={summary?.funnel.free_limit_hits_30d ?? 0} max={funnelMax || 1} color="#ffd54f" />
        <FunnelBar label="Upgrade clicked" value={summary?.funnel.upgrade_clicks_30d ?? 0} max={funnelMax || 1} color="#7c4dff" />
        <FunnelBar label="Checkout completed" value={summary?.funnel.checkout_completions_30d ?? 0} max={funnelMax || 1} color="#4caf50" />
      </Card>

      {/* CLI + Web row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* CLI telemetry */}
        <Card>
          <SectionTitle>CLI Telemetry — 30d</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Stat
              label="Unique installs"
              value={(summary?.cli.unique_installs_30d ?? 0).toLocaleString()}
            />
            <Stat
              label="Total commands"
              value={(summary?.cli.total_commands_30d ?? 0).toLocaleString()}
            />
            <Stat
              label="Success rate"
              value={`${summary?.cli.success_rate_pct ?? 0}%`}
              color={(summary?.cli.success_rate_pct ?? 0) >= 90 ? '#4caf50' : '#ffd54f'}
            />
            <Stat
              label="Avg duration"
              value={summary?.cli.avg_duration_ms ? `${(summary.cli.avg_duration_ms / 1000).toFixed(1)}s` : '—'}
            />
          </div>
          {summary?.cli.command_breakdown && summary.cli.command_breakdown.length > 0 ? (
            <div>
              <div style={{ fontSize: 10, color: '#333', marginBottom: 8 }}>By command</div>
              {summary.cli.command_breakdown.map(c => (
                <div key={c.command} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 0', borderBottom: '1px solid #0d0d1a',
                }}>
                  <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{c.command}</span>
                  <span style={{ fontSize: 11, color: '#ccc', fontFamily: 'monospace' }}>
                    {c.count} <span style={{ color: '#333' }}>({(c.avg_ms / 1000).toFixed(1)}s avg)</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#333', textAlign: 'center', padding: '8px 0' }}>
              No CLI events yet. Telemetry fires on first <code style={{ color: '#555' }}>content-grade</code> run.
            </div>
          )}
        </Card>

        {/* Web tools */}
        <Card>
          <SectionTitle>Web Tools — Today</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Stat
              label="Requests today"
              value={(summary?.web.today.total_requests ?? 0).toLocaleString()}
            />
            <Stat
              label="Unique IPs today"
              value={(summary?.web.today.unique_ips ?? 0).toLocaleString()}
            />
          </div>
          {summary?.web.tool_usage_7d && summary.web.tool_usage_7d.length > 0 ? (
            <div>
              <div style={{ fontSize: 10, color: '#333', marginBottom: 8 }}>By tool (7d)</div>
              {summary.web.tool_usage_7d.slice(0, 6).map(t => (
                <div key={t.endpoint} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 0', borderBottom: '1px solid #0d0d1a',
                }}>
                  <span style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>
                    {t.endpoint.replace('/api/demos/', '')}
                  </span>
                  <span style={{ fontSize: 11, color: '#ccc', fontFamily: 'monospace' }}>
                    {t.total.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#333', textAlign: 'center', padding: '8px 0' }}>
              No web tool usage tracked yet.
            </div>
          )}
          {/* DAU chart (sparkline) */}
          {summary?.web.daily_active_users_7d && summary.web.daily_active_users_7d.length > 1 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: '#333', marginBottom: 8 }}>Daily unique IPs (7d)</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32 }}>
                {[...summary.web.daily_active_users_7d].reverse().map(d => {
                  const max = Math.max(...summary.web.daily_active_users_7d.map(x => x.unique_ips), 1);
                  const h = Math.max(2, Math.round((d.unique_ips / max) * 32));
                  return (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.unique_ips} unique IPs`}
                      style={{
                        flex: 1, height: h, background: '#7c4dff55', borderRadius: 2,
                        minWidth: 8,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* npm + GitHub row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* npm downloads */}
        <Card>
          <SectionTitle>npm Downloads</SectionTitle>
          {npm ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <Stat label="This week" value={npm.last_week.toLocaleString()} />
                <Stat label="This month" value={npm.last_month.toLocaleString()} />
                <Stat label="All time" value={npm.last_year.toLocaleString()} />
              </div>
              <div style={{ fontSize: 10, color: '#333' }}>
                Package: <code style={{ color: '#555' }}>content-grade</code>
                {npm.status === 'awaiting_first_download' && (
                  <span style={{ color: '#ffd54f', marginLeft: 8 }}>awaiting first download</span>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: '#333', padding: '8px 0' }}>
              No npm snapshot yet. Run:{' '}
              <code style={{ color: '#555', fontSize: 10 }}>npm run metrics</code>
            </div>
          )}
          {npmStats && (
            <div style={{ marginTop: 12, fontSize: 10, color: '#222' }}>
              {npmStats.snapshot_count} snapshot{npmStats.snapshot_count !== 1 ? 's' : ''} ·{' '}
              last updated {npmStats.newest_snapshot ? new Date(npmStats.newest_snapshot).toLocaleDateString() : '—'}
            </div>
          )}
        </Card>

        {/* GitHub traffic */}
        <Card>
          <SectionTitle>GitHub Traffic</SectionTitle>
          {github ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <Stat label="Stars" value={github.engagement.stars.toLocaleString()} color="#ffd54f" />
                <Stat label="Forks" value={github.engagement.forks.toLocaleString()} />
                <Stat label="Views (14d)" value={github.views.count_14d.toLocaleString()} />
                <Stat label="Clones (14d)" value={github.clones.count_14d.toLocaleString()} />
              </div>
              {github.top_referrers.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#333', marginBottom: 6 }}>Top referrers</div>
                  {github.top_referrers.slice(0, 4).map(r => (
                    <div key={r.referrer} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 10, color: '#555', padding: '2px 0',
                    }}>
                      <span>{r.referrer}</span>
                      <span style={{ fontFamily: 'monospace', color: '#444' }}>{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 11, color: '#333', padding: '8px 0' }}>
              No GitHub snapshot yet. Run:{' '}
              <code style={{ color: '#555', fontSize: 10 }}>npm run metrics</code>
            </div>
          )}
        </Card>
      </div>

      {/* Leads */}
      <Card>
        <SectionTitle>Email Leads — 30d</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Stat
            label="Email captures"
            value={(summary?.leads.email_captures_30d ?? 0).toLocaleString()}
            sub="total email submissions"
          />
          <Stat
            label="Unique emails"
            value={(summary?.leads.unique_emails_30d ?? 0).toLocaleString()}
            sub="distinct leads"
          />
        </div>
      </Card>

      <div style={{ marginTop: 16, fontSize: 10, color: '#222', textAlign: 'right' }}>
        Generated: {summary?.generated_at ? new Date(summary.generated_at).toLocaleString() : '—'}
      </div>
    </div>
  );
}
