import { describe, expect, it } from 'vitest';
import { errorGroupsPath } from '../src/pages/admin/command/AppsModule.js';

describe('errorGroupsPath', () => {
  it('encodes the app slug', () => {
    expect(errorGroupsPath('my app&x', 1)).toBe('/admin/observability/errors?app=my%20app%26x&days=1');
  });

  it('appends env only when given', () => {
    expect(errorGroupsPath('a', 7)).not.toContain('env=');
    expect(errorGroupsPath('a', 7, 'prod')).toBe('/admin/observability/errors?app=a&days=7&env=prod');
  });
});
