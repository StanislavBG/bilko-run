import { afterAll, vi } from 'vitest';

// The single fork shares fake-timer state across files, so restore real timers after every file.
afterAll(() => {
  vi.useRealTimers();
});
