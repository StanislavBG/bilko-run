// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const placeMenuOrder = vi.fn();
const getWalletCents = vi.fn();
vi.mock('../server/services/menu-orders.js', () => ({ placeMenuOrder: (...a: unknown[]) => placeMenuOrder(...a) }));
vi.mock('../server/services/wallet.js', () => ({ getWalletCents: (...a: unknown[]) => getWalletCents(...a) }));

import { buildCatalogMcpServer } from '../server/routes/project-catalog.js';
import { menuPayload } from '../shared/bilko-menu.js';

async function call(
  auth: { email: string | null; ipHash: string; invalidKey?: boolean } | undefined,
  name: string,
  args: Record<string, unknown> = {},
) {
  const server = buildCatalogMcpServer(auth, async () => []);
  const client = new Client({ name: 't', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  try {
    const res = await client.callTool({ name, arguments: args });
    return res as { isError?: boolean; content: { text: string }[] };
  } finally {
    await client.close();
    await server.close();
  }
}

const KEYED = { email: 'agent@example.com', ipHash: 'h' };

beforeEach(() => { placeMenuOrder.mockReset(); getWalletCents.mockReset(); });

describe('menu MCP tools', () => {
  it('list_menu needs no key and returns menuPayload()', async () => {
    const res = await call(undefined, 'list_menu');
    expect(res.isError).toBeFalsy();
    expect(JSON.parse(res.content[0].text)).toEqual(menuPayload());
  });

  it('wallet_balance and order_menu_item refuse without a key, and with an invalid key', async () => {
    for (const auth of [undefined, { email: null, ipHash: 'h', invalidKey: true }]) {
      for (const [name, args] of [['wallet_balance', {}], ['order_menu_item', { itemId: 'x', intake: {} }]] as const) {
        const res = await call(auth, name, args);
        expect(res.isError).toBe(true);
        expect(res.content[0].text).toContain('https://bilko.run/buy/credits-5');
        expect(res.content[0].text).toContain('Authorization: Bearer bkk_...');
      }
    }
    expect(placeMenuOrder).not.toHaveBeenCalled();
  });

  it('wallet_balance returns cents and formatted balance', async () => {
    getWalletCents.mockResolvedValue(450);
    const res = await call(KEYED, 'wallet_balance');
    expect(JSON.parse(res.content[0].text)).toEqual({ balanceCents: 450, balance: '$4.50' });
  });

  it('order_menu_item places an order via mcp and returns id, status and balance', async () => {
    placeMenuOrder.mockResolvedValue({
      status: 'ok',
      order: { id: 7, item_id: 'some-item', status: 'queued', price_cents: 100 },
      balanceCents: 400,
    });
    const res = await call(KEYED, 'order_menu_item', { itemId: 'some-item', intake: { a: 'b' } });
    expect(res.isError).toBeFalsy();
    expect(placeMenuOrder).toHaveBeenCalledWith({ email: 'agent@example.com', itemId: 'some-item', intake: { a: 'b' }, via: 'mcp' });
    const data = JSON.parse(res.content[0].text);
    expect(data).toMatchObject({ orderId: 7, status: 'queued', balanceCents: 400, balance: '$4' });
  });

  it('maps failure statuses to isError text', async () => {
    placeMenuOrder.mockResolvedValueOnce({ status: 'insufficient_credits', balanceCents: 50 });
    const poor = await call(KEYED, 'order_menu_item', { itemId: 'i', intake: {} });
    expect(poor.isError).toBe(true);
    expect(poor.content[0].text).toContain('insufficient_credits');
    expect(poor.content[0].text).toContain('https://bilko.run/buy/credits-5');
    for (const status of ['daily_cap', 'invalid_intake', 'unknown_item', 'live_needs_slot']) {
      placeMenuOrder.mockResolvedValueOnce({ status });
      const res = await call(KEYED, 'order_menu_item', { itemId: 'i', intake: {} });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain(status);
    }
  });

  it('limits order_menu_item to 20 calls a minute per key email', async () => {
    placeMenuOrder.mockResolvedValue({ status: 'unknown_item' });
    const auth = { email: 'burst@example.com', ipHash: 'h' };
    for (let i = 0; i < 20; i++) await call(auth, 'order_menu_item', { itemId: 'i', intake: {} });
    expect(placeMenuOrder).toHaveBeenCalledTimes(20);
    const res = await call(auth, 'order_menu_item', { itemId: 'i', intake: {} });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Too many');
    expect(placeMenuOrder).toHaveBeenCalledTimes(20);
  });
});
