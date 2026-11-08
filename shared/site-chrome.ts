// Site chrome data shared by the React Layout (via src/data/portfolio.ts) and the server's
// pre-rendered /book HTML. Keep this module pure (no imports) so the server can import it.

export interface SiteSection {
  readonly id: string;
  readonly label: string;
  readonly path: string;
}

export const SITE_SECTIONS: readonly SiteSection[] = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'projects', label: 'Projects', path: '/projects' },
  { id: 'hire', label: 'Hire', path: '/book' },
  { id: 'blog', label: 'Blog', path: '/blog' },
  { id: 'contact', label: 'Contact', path: '/contact' },
  { id: 'forum', label: 'Forum', path: '/forum' },
];

export const NOW_ITEMS: readonly string[] = [
  'Social Signals Trader running live, in public',
  'signal-builder split out into its own hosted MCP service',
  'Academy: 13 free, plain-language lessons on using Claude',
  'New build log up on the blog',
];
