/**
 * Deploy-safe shutdown.
 *
 * On a deploy Render moves traffic to the new instance, waits 60 s, sends
 * SIGTERM to the old one, then SIGKILLs it after the service's shutdown delay
 * (`maxShutdownDelaySeconds`: 30 s by default, 300 s max, set through the
 * Render API — see docs/deployment.md). Anything still streaming from the old
 * instance only survives if the process stays up.
 *
 * The old handler force-exited 10 s after SIGTERM, which cut slow downloads
 * mid-body — a 61 MB Godot build froze its loader at ~25%. Now SIGTERM drains:
 * `app.close()` stops accepting connections, closes idle keep-alives, and
 * resolves once every in-flight response has finished. Long-lived sockets
 * that would hold the drain open forever (the WebSocket relays) close
 * themselves from `preClose` hooks so their clients reconnect to the new
 * instance. `drainMs` is only a backstop for a close that never resolves;
 * Render's SIGKILL is the real bound.
 *
 * SIGINT (local Ctrl-C) keeps the short grace, and a second signal exits now.
 */

export const DEFAULT_DRAIN_SECONDS = 290;
export const INTERRUPT_GRACE_MS = 10_000;

/** `SHUTDOWN_DRAIN_SECONDS` → ms; unset/invalid falls back to the default. */
export function drainWindowMs(raw: string | undefined): number {
  const n = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_DRAIN_SECONDS * 1000;
  return Math.round(Math.min(n, 3600) * 1000);
}

export type ShutdownSignal = 'SIGTERM' | 'SIGINT';

export function shutdownCapMs(signal: ShutdownSignal, drainMs: number): number {
  return signal === 'SIGTERM' ? drainMs : Math.min(drainMs, INTERRUPT_GRACE_MS);
}

/** How often the drain closes connections that went idle after their response. */
export const IDLE_SWEEP_MS = 500;

export function createShutdown(
  app: { close(): Promise<unknown>; server?: { closeIdleConnections?(): void } },
  opts: { drainMs: number; exit?: (code: number) => void; log?: (msg: string) => void },
): (signal: ShutdownSignal) => void {
  const exit = opts.exit ?? ((code: number) => process.exit(code));
  const log = opts.log ?? ((msg: string) => console.log(msg));
  let shuttingDown = false;
  return (signal) => {
    if (shuttingDown) {
      log(`[Shutdown] second ${signal}, exiting without waiting for the drain`);
      exit(1);
      return;
    }
    shuttingDown = true;
    const cap = shutdownCapMs(signal, opts.drainMs);
    log(`[Shutdown] ${signal} received, draining in-flight responses (up to ${Math.round(cap / 1000)} s)`);
    const killer = setTimeout(() => {
      log('[Shutdown] drain window elapsed, exiting with responses still open');
      exit(1);
    }, cap);
    killer.unref();
    // close() drops idle keep-alives once, at the start. A connection that
    // finishes its download later would otherwise sit idle for Fastify's
    // 72 s keepAliveTimeout and hold the close open.
    const sweep = setInterval(() => app.server?.closeIdleConnections?.(), IDLE_SWEEP_MS);
    sweep.unref();
    const done = (code: number) => { clearTimeout(killer); clearInterval(sweep); exit(code); };
    app.close().then(() => done(0), () => done(1));
  };
}
