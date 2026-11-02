import { describe, expect, it } from 'vitest';
import { BILKO_PROFILE_BOTTOM_HTML, BILKO_PROFILE_TOP_HTML } from '../shared/bilko-profile';
import { identityHits } from './identity-denylist';

const all = BILKO_PROFILE_TOP_HTML + BILKO_PROFILE_BOTTOM_HTML;

describe('Human For Hire copy', () => {
  it('carries the approved headline copy and three prices', () => {
    expect(all).toContain('Human For Hire');
    expect(all).toContain('Start with a free hour');
    expect(all.split('$100 / hour')).toHaveLength(4);
  });

  it('has no preview marks or scripts', () => {
    for (const bad of ['Preview', 'Not live', '<script']) expect(all).not.toContain(bad);
  });

  it('passes the identity deny-list', () => {
    expect(identityHits(all)).toEqual([]);
  });
});
