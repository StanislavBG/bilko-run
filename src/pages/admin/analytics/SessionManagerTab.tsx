import { useState, type ReactNode } from 'react';
import { useAdminResource } from '../../../hooks/useAdmin.js';
import { LoadingState } from './parts.js';

interface TabProps {
  days: number;
  excludeSelf: boolean;
}

type Env = 'prod' | 'dev' | 'test' | 'all';
const ENVS: Env[] = ['prod', 'dev', 'test', 'all'];

// Mirrors the response of GET /api/admin/session-manager/usage. Timestamps are epoch SECONDS.
interface UsageResponse {
  generatedAt: number;
  windowDays: number;
  env?: string;
  includeTest?: boolean;
  excludeSelf?: boolean;
  installs: {
    total: number;
    active7: number;
    active30: number;
    new7: number;
    byVersion: Array<{ version: string; installs: number; active7: number }>;
    byPlatform: Array<{ platform: string; arch: string; installs: number }>;
    specs: { medianTotalMemMb: number | null; medianCpuCount: number | null };
    seeds?: Array<{ seed: string; done: number; pending: number; failed: number; exhausted: number }>;
  };
  usage: {
    daily: Array<{ date: string; launches: number; sessions: number; epics: number; installsSeen: number }>;
    byVersion: Array<{ version: string; launches: number; sessions: number }>;
  };
  issues: Array<{
    signature: string;
    name: string;
    msg: string;
    occurrences: number;
    installsAffected: number;
    firstSeen: number;
    lastSeen: number;
    versions: string[];
    topPlatform: string;
  }>;
  errors: {
    byVersion: Array<{ version: string; errors: number; warns: number; installsAffected: number }>;
    daily: Array<{ date: string; errors: number; warns: number }>;
  };
  perInstall?: Array<{
    id: string;
    version: string;
    platform: string;
    arch: string;
    firstSeen: number;
    lastSeen: number;
    seeds?: Record<string, string> | null;
    last7: InstallCounts;
    prev7: InstallCounts;
  }>;
}

interface InstallCounts { launches: number; sessions: number; epics: number; errors: number }

// "12 / 4" — last 7d against the 7d before it.
function vsPrev(cur: number, prev: number): string {
  return `${cur} / ${prev}`;
}

// "all done", or only the steps that are not done: "schedulerMcp failed, agentPersonas pending".
function setupSummary(seeds: Record<string, string> | null | undefined): string {
  if (!seeds) return '—';
  const open = Object.entries(seeds).filter(([, status]) => status !== 'done');
  return open.length === 0 ? 'all done' : open.map(([step, status]) => `${step} ${status}`).join(', ');
}

const PT_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  timeZoneName: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatPtSeconds(sec: number | null): string {
  return sec ? PT_FORMAT.format(new Date(sec * 1000)) : '—';
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-warm-200/60 p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-warm-400">{label}</div>
      <div className="text-2xl font-extrabold text-warm-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-warm-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-warm-200/60 p-5">
      <h2 className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: Array<{ label: string; right?: boolean }>;
  rows: ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-warm-400">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-warm-100">
            {headers.map(h => (
              <th key={h.label} className={`${h.right ? 'text-right' : 'text-left'} py-1 px-2 text-xs font-bold text-warm-400`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-warm-50">
              {cells.map((c, j) => (
                <td key={j} className={`py-1.5 px-2 ${headers[j]?.right ? 'text-right' : ''} text-warm-800`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SessionManagerTab({ days, excludeSelf }: TabProps) {
  const [env, setEnv] = useState<Env>('prod');
  const [includeTest, setIncludeTest] = useState(false);
  const { data, error, loading } = useAdminResource<UsageResponse>(
    `/admin/session-manager/usage?days=${days}&env=${env}`
      + `&exclude_self=${excludeSelf ? '1' : '0'}&includeTest=${includeTest ? '1' : '0'}`,
  );

  const picker = (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-warm-600">Env</span>
      {ENVS.map(e => (
        <button
          key={e}
          onClick={() => setEnv(e)}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
            env === e ? 'bg-fire-500 text-white' : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
          }`}
        >
          {e}
        </button>
      ))}
      <label className="flex items-center gap-1.5 ml-4 text-xs font-semibold text-warm-600">
        <input type="checkbox" checked={includeTest} onChange={e => setIncludeTest(e.target.checked)} />
        Include test installs
      </label>
    </div>
  );

  if (!data) {
    return (
      <div className="space-y-6">
        {picker}
        <LoadingState loading={loading} error={error} label="session manager" />
      </div>
    );
  }

  const { installs, usage, issues, errors } = data;
  const sum = (key: 'launches' | 'sessions' | 'epics') => usage.daily.reduce((n, r) => n + r[key], 0);
  const { medianTotalMemMb, medianCpuCount } = installs.specs;
  const machine =
    medianTotalMemMb == null && medianCpuCount == null
      ? '—'
      : `${medianTotalMemMb == null ? '—' : (medianTotalMemMb / 1024).toFixed(1)} GB · ${medianCpuCount ?? '—'} CPUs`;

  return (
    <div className="space-y-6">
      {picker}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Installs" value={installs.total} sub={`+${installs.new7} new (7d)`} />
        <Kpi label="Active 7d" value={installs.active7} />
        <Kpi label="Active 30d" value={installs.active30} />
        <Kpi label={`Launches (${data.windowDays}d)`} value={sum('launches')} />
        <Kpi label={`Sessions (${data.windowDays}d)`} value={sum('sessions')} />
        <Kpi label={`Epics (${data.windowDays}d)`} value={sum('epics')} />
        <Kpi label="Median machine" value={machine} />
      </div>

      <Panel title="Installs (last 7d / prior 7d)">
        <Table
          headers={[
            { label: 'Install' },
            { label: 'Version' },
            { label: 'Platform' },
            { label: 'First seen' },
            { label: 'Last seen' },
            { label: 'Setup' },
            { label: 'Launches', right: true },
            { label: 'Sessions', right: true },
            { label: 'Epics', right: true },
            { label: 'Errors', right: true },
          ]}
          rows={(data.perInstall ?? []).map(r => [
            <code key="id" className="text-xs">{r.id}</code>,
            r.version,
            `${r.platform}/${r.arch}`,
            formatPtSeconds(r.firstSeen),
            formatPtSeconds(r.lastSeen),
            setupSummary(r.seeds),
            vsPrev(r.last7.launches, r.prev7.launches),
            vsPrev(r.last7.sessions, r.prev7.sessions),
            vsPrev(r.last7.epics, r.prev7.epics),
            vsPrev(r.last7.errors, r.prev7.errors),
          ])}
          empty="No installs yet"
        />
        <p className="text-xs text-warm-400 mt-3">
          {excludeSelf ? 'Owner install excluded.' : 'Owner install included.'}{' '}
          {includeTest ? 'Test installs included.' : 'Test installs (Electron-version, 0.0.0-*, empty) excluded.'}
        </p>
      </Panel>

      <Panel title="Installs by version">
        <Table
          headers={[{ label: 'Version' }, { label: 'Installs', right: true }, { label: 'Active 7d', right: true }]}
          rows={installs.byVersion.map(r => [r.version, r.installs, r.active7])}
          empty="No installs yet"
        />
      </Panel>

      <Panel title="Installs by platform">
        <Table
          headers={[{ label: 'Platform' }, { label: 'Arch' }, { label: 'Installs', right: true }]}
          rows={installs.byPlatform.map(r => [r.platform, r.arch, r.installs])}
          empty="No installs yet"
        />
      </Panel>

      <Panel title="First-run setup">
        <Table
          headers={[
            { label: 'Step' },
            { label: 'Done', right: true },
            { label: 'Pending', right: true },
            { label: 'Failed', right: true },
            { label: 'Exhausted', right: true },
          ]}
          rows={(installs.seeds ?? []).map(r => [r.seed, r.done, r.pending, r.failed, r.exhausted])}
          empty="No install has reported its setup steps yet"
        />
        <p className="text-xs text-warm-400 mt-3">
          Installs per step, from each machine's latest install report. Failed steps are retried;
          exhausted ones hit the retry limit and need the manual fix.
        </p>
      </Panel>

      <Panel title="Issues">
        <Table
          headers={[
            { label: 'Issue' },
            { label: 'Installs', right: true },
            { label: 'Occurrences', right: true },
            { label: 'Versions' },
            { label: 'Top platform' },
            { label: 'Last seen' },
          ]}
          rows={issues.map(r => [
            <span key="n" className="font-medium">{r.name}{r.msg ? `: ${r.msg}` : ''}</span>,
            r.installsAffected,
            r.occurrences,
            r.versions.join(', ') || '—',
            r.topPlatform,
            formatPtSeconds(r.lastSeen),
          ])}
          empty="No issues in this window"
        />
      </Panel>

      <Panel title="Usage by version">
        <Table
          headers={[{ label: 'Version' }, { label: 'Launches', right: true }, { label: 'Sessions', right: true }]}
          rows={usage.byVersion.map(r => [r.version, r.launches, r.sessions])}
          empty="No usage in this window"
        />
      </Panel>

      <Panel title="Errors by version">
        <Table
          headers={[
            { label: 'Version' },
            { label: 'Errors', right: true },
            { label: 'Warns', right: true },
            { label: 'Installs affected', right: true },
          ]}
          rows={errors.byVersion.map(r => [r.version, r.errors, r.warns, r.installsAffected])}
          empty="No errors in this window"
        />
      </Panel>

      <Panel title="Daily usage">
        <Table
          headers={[
            { label: 'Date' },
            { label: 'Launches', right: true },
            { label: 'Sessions', right: true },
            { label: 'Epics', right: true },
            { label: 'Installs seen', right: true },
          ]}
          rows={usage.daily.map(r => [r.date, r.launches, r.sessions, r.epics, r.installsSeen])}
          empty="No activity in this window"
        />
      </Panel>
    </div>
  );
}
