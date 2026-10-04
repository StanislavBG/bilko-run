import { describe, expect, it, vi } from 'vitest';
import { createBus } from '../src/games/bus';

type Events = {
  cellSelected: { row: number; col: number };
  gameOver: { won: boolean };
};

describe('createBus', () => {
  it('fires handler on emit', () => {
    const bus = createBus<Events>();
    const spy = vi.fn();
    bus.on('cellSelected', spy);
    bus.emit('cellSelected', { row: 1, col: 2 });
    expect(spy).toHaveBeenCalledWith({ row: 1, col: 2 });
  });

  it('off() returned from on() removes handler', () => {
    const bus = createBus<Events>();
    const spy = vi.fn();
    const off = bus.on('cellSelected', spy);
    off();
    bus.emit('cellSelected', { row: 0, col: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('bus.off() removes handler', () => {
    const bus = createBus<Events>();
    const spy = vi.fn();
    bus.on('cellSelected', spy);
    bus.off('cellSelected', spy);
    bus.emit('cellSelected', { row: 0, col: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('multiple handlers on same event all fire', () => {
    const bus = createBus<Events>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('gameOver', a);
    bus.on('gameOver', b);
    bus.emit('gameOver', { won: true });
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });
});
