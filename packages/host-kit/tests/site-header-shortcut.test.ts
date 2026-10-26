import { describe, it, expect } from 'vitest';
import { searchShortcutLabel } from '../src/SiteHeader';

describe('searchShortcutLabel', () => {
  it('mac -> ⌘K', () => expect(searchShortcutLabel({ platform: 'MacIntel' })).toBe('⌘K'));
  it('iPhone -> ⌘K', () => expect(searchShortcutLabel({ platform: 'iPhone' })).toBe('⌘K'));
  it('Windows -> Ctrl K', () => expect(searchShortcutLabel({ platform: 'Win32' })).toBe('Ctrl K'));
  it('Linux -> Ctrl K', () => expect(searchShortcutLabel({ platform: 'Linux x86_64' })).toBe('Ctrl K'));
  it('userAgent fallback', () =>
    expect(searchShortcutLabel({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' })).toBe('⌘K'));
  it('userAgentData takes precedence over platform', () => {
    expect(searchShortcutLabel({ platform: 'MacIntel', userAgentData: { platform: 'Windows' } })).toBe('Ctrl K');
    expect(searchShortcutLabel({ platform: 'Win32', userAgentData: { platform: 'macOS' } })).toBe('⌘K');
  });
  it('undefined navigator -> Ctrl K', () => {
    expect(searchShortcutLabel(undefined)).toBe('Ctrl K');
  });
});
