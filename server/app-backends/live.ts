/**
 * The live app-backend forwarding map. Built from getRegistrySnapshot() at creation and rebuilt
 * on every onRegistryChange, so a host.backend set, changed or cleared through the registry API
 * takes effect without a restart. APP_BACKENDS is parsed once (env does not change at runtime)
 * and still wins for its slugs. The HTTP and WebSocket forwarders read current() per request.
 */
import { getRegistrySnapshot, onRegistryChange } from '../registry-runtime.js';
import { appBackendsFromRegistry, mergeAppBackends, parseAppBackends, type ResolvedAppBackend } from './config.js';

export interface LiveAppBackends {
  /** The map in force right now. */
  current(): readonly ResolvedAppBackend[];
  /** Slug -> source only; origins stay out of the public health response. */
  sources(): Record<string, 'registry' | 'env'>;
  /** Stop listening for registry changes. */
  stop(): void;
}

export function createLiveAppBackends(opts: {
  envRaw?: string;
  warn?: (msg: string) => void;
  log?: (msg: string) => void;
} = {}): LiveAppBackends {
  const warn = opts.warn ?? ((m: string) => console.warn(m));
  const log = opts.log ?? ((m: string) => console.log(m));
  const fromEnv = parseAppBackends(opts.envRaw, warn);
  let map: readonly ResolvedAppBackend[] = [];
  let key = '[]';

  const rebuild = (snapshot: readonly unknown[]): void => {
    const next = Object.freeze(mergeAppBackends(fromEnv, appBackendsFromRegistry(snapshot, warn)));
    const nextKey = JSON.stringify(next);
    map = next;
    if (nextKey === key) return;
    key = nextKey;
    if (next.length === 0) log('[app-backends] forwarding nothing');
    for (const b of next) {
      log(`[app-backends] forwarding ${b.prefix} -> ${b.origin}/api/ (${b.source === 'env' ? 'env APP_BACKENDS' : 'registry'})`);
    }
  };

  rebuild(getRegistrySnapshot());
  const unsubscribe = onRegistryChange(rebuild);

  return {
    current: () => map,
    sources: () => Object.fromEntries(map.map((b) => [b.slug, b.source])),
    stop: unsubscribe,
  };
}
