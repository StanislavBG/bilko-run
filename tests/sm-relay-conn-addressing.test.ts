// The agent holds one E2E session per browser conn, so the relay must tag
// browser→device envelopes with an unspoofable sender conn, unicast
// device→browser envelopes that carry toConn, and tell the device when a
// browser conn goes away.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import crypto from 'node:crypto';
import WebSocket from 'ws';
import { handleUpgrade, browserConns, deviceConns, notifyClientRevoked, RELAY_WS_PATH } from '../server/sm-relay/router.js';
import { issueWsTicket } from '../server/sm-relay/tokens.js';

const OWNER = 'conn-owner@test.com';
const OTHER = 'conn-other@test.com';
const DEVICE_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const OTHER_DEVICE_ID = 'a1b2c3d4-0000-4000-8000-000000000002';

type Msg = Record<string, any>;
interface Peer { ws: WebSocket; msgs: Msg[]; next: (pred: (m: Msg) => boolean) => Promise<Msg>; }

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
  const next = async (pred: (m: Msg) => boolean): Promise<Msg> => {
    await waitFor(() => msgs.some(pred));
    return msgs.splice(msgs.findIndex(pred), 1)[0];
  };
  await next((m) => m.type === 'auth:ok');
  return { ws, msgs, next };
}

const browser = (userId = OWNER, clientId?: string) => connect({ userId, email: userId, role: 'browser', clientId });
const device = (userId = OWNER, deviceId = DEVICE_ID) => connect({ userId, email: userId, role: 'agent', deviceId });
const env = (type: string, extra: Msg = {}) => JSON.stringify({ type, id: crypto.randomUUID(), ts: Date.now(), ...extra });
const connIdOf = (clientId?: string, userId = OWNER) =>
  [...browserConns.values()].find((c) => c.userId === userId && c.clientId === clientId)!.id;

describe('sm-relay conn addressing', () => {
  it('stamps a distinct fromConn/fromClientId per sender', async () => {
    const dev = await device();
    const phone = await browser();
    const desk = await browser(OWNER, 'client-1');
    const phoneId = connIdOf(undefined);
    const deskId = connIdOf('client-1');
    expect(phoneId).not.toBe(deskId);

    phone.ws.send(env('e2e:hello', { deviceId: DEVICE_ID }));
    desk.ws.send(env('e2e:hello', { deviceId: DEVICE_ID }));
    const a = await dev.next((m) => m.type === 'e2e:hello' && m.fromConn === phoneId);
    const b = await dev.next((m) => m.type === 'e2e:hello' && m.fromConn === deskId);
    expect(a.fromClientId).toBeNull();
    expect(b.fromClientId).toBe('client-1');
  });

  it('overwrites a spoofed fromConn/fromClientId from the browser', async () => {
    const dev = await device();
    const phone = await browser();
    await browser(OWNER, 'victim-client');
    const phoneId = connIdOf(undefined);
    const victimId = connIdOf('victim-client');

    phone.ws.send(env('e2e:box', { deviceId: DEVICE_ID, fromConn: victimId, fromClientId: 'victim-client' }));
    const m = await dev.next((x) => x.type === 'e2e:box');
    expect(m.fromConn).toBe(phoneId);
    expect(m.fromClientId).toBeNull();
  });

  it('toConn delivers to exactly one browser conn', async () => {
    const dev = await device();
    const phone = await browser();
    const desk = await browser(OWNER, 'client-1');
    const deskId = connIdOf('client-1');

    dev.ws.send(env('e2e:box', { toConn: deskId, payload: 'only-desk' }));
    dev.ws.send(env('marker'));
    const got = await desk.next((m) => m.type === 'e2e:box');
    expect(got.payload).toBe('only-desk');
    expect(got.deviceId).toBe(DEVICE_ID);
    expect(got.toConn).toBeUndefined();
    await phone.next((m) => m.type === 'marker');
    expect(phone.msgs.some((m) => m.type === 'e2e:box')).toBe(false);
  });

  it('without toConn keeps broadcasting to every same-user browser', async () => {
    const dev = await device();
    const phone = await browser();
    const desk = await browser(OWNER, 'client-1');
    dev.ws.send(env('event:session:list'));
    await phone.next((m) => m.type === 'event:session:list');
    await desk.next((m) => m.type === 'event:session:list');
  });

  it('drops a toConn that names another user\'s conn', async () => {
    await device();
    const otherDev = await device(OTHER, OTHER_DEVICE_ID);
    const victim = await browser(OWNER);
    const victimId = connIdOf(undefined, OWNER);
    const otherBrowser = await browser(OTHER);

    otherDev.ws.send(env('e2e:box', { toConn: victimId, payload: 'leak' }));
    otherDev.ws.send(env('marker'));
    await otherBrowser.next((m) => m.type === 'marker');
    expect(victim.msgs.some((m) => m.type === 'e2e:box' || m.type === 'marker')).toBe(false);
  });

  it('tells the device when a browser conn closes', async () => {
    const dev = await device();
    const other = await device(OTHER, OTHER_DEVICE_ID);
    const phone = await browser();
    const phoneId = connIdOf(undefined);

    phone.ws.close();
    const m = await dev.next((x) => x.type === 'event:client:disconnected');
    expect(m).toMatchObject({ fromConn: phoneId, fromClientId: null, reason: 'closed' });
    expect(typeof m.id).toBe('string');
    expect(other.msgs.some((x) => x.type === 'event:client:disconnected')).toBe(false);
  });

  it('reports token_revoked when notifyClientRevoked closes the conn', async () => {
    const dev = await device();
    await browser(OWNER, 'client-9');
    const deskId = connIdOf('client-9');

    notifyClientRevoked('client-9');
    const m = await dev.next((x) => x.type === 'event:client:disconnected');
    expect(m).toMatchObject({ fromConn: deskId, fromClientId: 'client-9', reason: 'token_revoked' });
  });
});
