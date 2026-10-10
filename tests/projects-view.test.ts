// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PUBLIC_CARDS } from '../src/data/projectsView';

// Captured from the pre-change code (hardcoded PUBLIC_SLUGS / DISPLAY_NAME).
const EXPECTED: ReadonlyArray<readonly [string, string]> = [
  ['session-manager', 'Session Manager'],
  ['social-signals-trader', 'Social Signals Trader'],
  ['escape-velocity', 'Escape Velocity'],
  ['academy', 'Academy'],
  ['git-viewer', 'Git Viewer'],
  ['bilko-host', 'Bilko Host MCP'],
  ['outdoor-hours', 'Weather'],
];

describe('projectsView public cards', () => {
  it('renders the same public slugs, order, and names as before the registry wiring', () => {
    expect(PUBLIC_CARDS.map(c => [c.slug, c.name])).toEqual(EXPECTED);
  });
});
