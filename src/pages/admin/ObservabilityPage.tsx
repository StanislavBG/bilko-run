import { useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useIsAdmin } from '../../hooks/useAdmin.js';
import { CommandShell, type RefreshOpt, type WindowOpt } from './command/CommandShell.js';
import { KpiStrip, Ticker } from './command/KpiStrip.js';
import { AppsModule, appTiles, appsSubtitle } from './command/AppsModule.js';
import { AudienceModule } from './command/AudienceModule.js';
import { BandwidthModule } from './command/BandwidthModule.js';
import { ClicksModule, clicksSubtitle } from './command/ClicksModule.js';
import { GlobeModule } from './command/GlobeModule.js';
import { SessionsModule } from './command/SessionsModule.js';
import { TrafficModule, trafficSubtitle } from './command/TrafficModule.js';
import { deriveKpis, deriveStatus, useCommandData } from './command/useCommandData.js';
import type { ModuleKey } from './command/types.js';

const WINDOW_DAYS: Record<WindowOpt, number> = { '1D': 1, '7D': 7, '30D': 30 };

// 5M stays the default: 30s polling from a tab left open all day made this the
// busiest API route on the host. Polling also pauses while the tab is hidden.
const REFRESH_MS: Record<RefreshOpt, number> = { '30S': 30_000, '1M': 60_000, '5M': 300_000, OFF: 0 };

const TONE = { green: 'ok', amber: 'warn', red: 'err', neutral: 'ok' } as const;

export function ObservabilityPage() {
  const { isLoaded } = useUser();
  const isAdmin = useIsAdmin();
  const [win, setWin] = useState<WindowOpt>('7D');
  const [refresh, setRefresh] = useState<RefreshOpt>('5M');

  const days = WINDOW_DAYS[win];
  const { traffic, flows, egress, blog, obs, failed } = useCommandData({
    days, refreshMs: REFRESH_MS[refresh], enabled: isAdmin,
  });

  useEffect(() => {
    document.title = 'Observability — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  // Countries of hits newer than the previous successful traffic fetch (none on first load).
  const fetchRef = useRef<{ prev: number | null; cur: number | null }>({ prev: null, cur: null });
  const pingCountries = useMemo(() => {
    const t = traffic.data;
    if (!t) return [];
    const f = fetchRef.current;
    if (f.cur !== t.generatedAt) { f.prev = f.cur; f.cur = t.generatedAt; }
    const cutoff = f.prev;
    if (cutoff === null) return [];
    return t.recent.filter(r => r.ts > cutoff && r.country).map(r => r.country as string);
  }, [traffic.data]);

  const tiles = useMemo(() => appTiles(flows.data, obs.data, Date.now()), [flows.data, obs.data]);
  const kpis = useMemo(
    () => deriveKpis(traffic.data, flows.data, egress.data, blog.data),
    [traffic.data, flows.data, egress.data, blog.data],
  );

  if (isLoaded && !isAdmin) return <Navigate to="/" replace />;
  if (!isLoaded) return <div className="p-12 text-center text-warm-400">Loading...</div>;

  const led = deriveStatus(obs.data, failed);

  const render = (key: ModuleKey, stage: boolean) => {
    switch (key) {
      case 'globe': return <GlobeModule stage={stage} traffic={traffic.data} pingCountries={pingCountries} />;
      case 'sessions': return <SessionsModule stage={stage} days={Math.min(30, days)} />;
      case 'apps': return <AppsModule stage={stage} flows={flows} obs={obs} />;
      case 'traffic': return <TrafficModule stage={stage} traffic={traffic} />;
      case 'audience': return <AudienceModule stage={stage} traffic={traffic} days={days} />;
      case 'clicks': return <ClicksModule stage={stage} traffic={traffic} />;
      case 'bandwidth': return <BandwidthModule stage={stage} egress={egress} days={days} />;
    }
  };

  return (
    <CommandShell
      layout="rails"
      window={win}
      onWindow={setWin}
      refresh={refresh}
      onRefresh={setRefresh}
      status={{ label: led.label, tone: TONE[led.tone] }}
      kpis={<KpiStrip tiles={kpis} />}
      ticker={<Ticker recent={traffic.data?.recent ?? []} />}
      headers={{
        globe: { sub: 'traffic origin' },
        sessions: { sub: 'journeys' },
        apps: appsSubtitle(tiles),
        traffic: { sub: trafficSubtitle() },
        audience: { sub: 'devices · visitors' },
        clicks: { sub: clicksSubtitle(traffic) },
        bandwidth: { sub: 'egress' },
      }}
      render={render}
    />
  );
}
