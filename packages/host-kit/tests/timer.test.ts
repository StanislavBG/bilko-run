import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameTimer } from '../src/games/useGameTimer';

describe('useGameTimer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('accumulates ms when not paused', async () => {
    const { result } = renderHook(() => useGameTimer({ paused: false }));
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(result.current.ms).toBeGreaterThanOrEqual(4900);
  });

  it('stays at 0 when paused from the start', async () => {
    const { result } = renderHook(() => useGameTimer({ paused: true }));
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(result.current.ms).toBe(0);
  });

  it('reset() sets ms back to 0', async () => {
    const { result } = renderHook(() => useGameTimer({ paused: false }));
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.ms).toBeGreaterThan(0);
    await act(async () => { result.current.reset(); });
    expect(result.current.ms).toBe(0);
  });
});
