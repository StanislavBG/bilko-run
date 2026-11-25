import { describe, it, expect } from 'vitest';
import { keySaveHint } from '../src/lib/adminKeyHint.js';

describe('keySaveHint', () => {
  it('read scope points at admin-key and BILKO_ADMIN_KEY', () => {
    const h = keySaveHint('read');
    expect(h.file).toBe('~/.config/bilko-host/admin-key');
    expect(h.envVar).toBe('BILKO_ADMIN_KEY');
    expect(h.command).toBe('(umask 077 && mkdir -p ~/.config/bilko-host && cat > ~/.config/bilko-host/admin-key)');
    expect(h.command).not.toContain('registry-key');
  });

  it('registry scope points at registry-key and BILKO_REGISTRY_KEY', () => {
    const h = keySaveHint('registry');
    expect(h.file).toBe('~/.config/bilko-host/registry-key');
    expect(h.envVar).toBe('BILKO_REGISTRY_KEY');
    expect(h.command).toBe('(umask 077 && mkdir -p ~/.config/bilko-host && cat > ~/.config/bilko-host/registry-key)');
    expect(h.command).not.toContain('admin-key');
  });
});
