import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const DELETED_FILES = [
  'src/pages/AcademyPage.tsx',
  'src/pages/AcademyLevelPage.tsx',
  'src/data/academy/lessons.tsx',
  'src/components/academy/Diagrams.tsx',
];

describe('academy retired from in-repo pages', () => {
  it('deletes the old in-repo Academy files', () => {
    for (const file of DELETED_FILES) {
      expect(fs.existsSync(path.join(process.cwd(), file))).toBe(false);
    }
  });

  it('App.tsx redirects /academy to the sibling course and drops the old imports', () => {
    const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
    expect(appSrc).toContain('RedirectAcademyToCourse');
    expect(appSrc).toContain('/projects/academy/');
    expect(appSrc).not.toContain('AcademyPage');
    expect(appSrc).not.toContain('AcademyLevelPage');
  });
});
