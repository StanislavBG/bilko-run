// A desktop whose socket dies abnormally (1006) reconnects before the relay
// notices the old socket is gone. The old socket's late close must not evict
// the live replacement, or every phone sees "desktop offline" until the next drop.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { handleUpgrade, browserConns, deviceConns, isDeviceOnline, RELAY_WS_PATH } from '../server/sm-relay/router.js';
import { issueWsTicket } from '../server/sm-relay/tokens.js';

const OWNER = 'reconnect-owner@test.com';
const DEVICE_ID = 'a1b2c3d4-0000-4000-8000-0000000000aa';

type Msg = Record<string, any>;
interface Peer { ws: WebSocket; msgs: Msg[]; }

let server: http.Server;
let port: number;
const open: WebSocket[] = [];

beforeAll(async () => {
  server = http.createServer();
  server.on('upgrade', (req, socket, head) => { if (!handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  await Promise.all(open.splice(0).map((ws) => new Promise<void>((r) => {
    if (ws.readyState === WebSocket.CLOSED) return r();
    ws.once('close', () => r());
    ws.close();
  })));
  await waitFor(() => browserConns.size === 0 && deviceConns.size === 0);
});

afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });

async function waitFor(cond: () => boolean, ms = 2000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
}

async function connect(ticket: Parameters<typeof issueWsTicket>[0]): Promise<Peer> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}${RELAY_WS_PATH}?ticket=${issueWsTicket(ticket)}`);
  open.push(ws);
  const msgs: Msg[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
  await waitFor(() => msgs.some((m) => m.type === 'auth:ok'));
  return { ws, msgs };
}

const device = () => connect({ userId: OWNER, email: OWNER, role: 'agent', deviceId: DEVICE_ID });
const browser = () => connect({ userId: OWNER, email: OWNER, role: 'browser' });
const statuses = (p: Peer, status: string) =>
  p.msgs.filter((m) => m.type === 'event:device:status' && m.deviceId === DEVICE_ID && m.status === status);

describe('sm-relay device reconnect', () => {
  it('a superseded socket closing does not evict the live replacement', async () => {
    const phone = await browser();
    const a = await device();
    const aClosed = new Promise<number>((r) => a.ws.once('close', (code) => r(code)));
    const b = await device();

    // The relay closes A itself on replacement; wait for that close to land.
    expect(await aClosed).toBe(4000);
    await waitFor(() => deviceConns.size === 1);
    await new Promise((r) => setTimeout(r, 50));

    expect(b.ws.readyState).toBe(WebSocket.OPEN);
    expect(isDeviceOnline(DEVICE_ID)).toBe(true);
    expect(statuses(phone, 'disconnected')).toHaveLength(0);
    expect(statuses(phone, 'connected').length).toBeGreaterThanOrEqual(2);
  });

  it('the live socket closing still reports the device offline', async () => {
    const phone = await browser();
    const a = await device();
    const b = await device();
    await waitFor(() => a.ws.readyState === WebSocket.CLOSED);
    b.ws.close();
    await waitFor(() => statuses(phone, 'disconnected').length === 1);
    expect(isDeviceOnline(DEVICE_ID)).toBe(false);
    expect(deviceConns.has(DEVICE_ID)).toBe(false);
  });
});
