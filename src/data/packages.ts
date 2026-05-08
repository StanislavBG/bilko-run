export interface Package {
  slug: string;
  name: string;
  npmName: string;
  description: string;
  install: string;
  github: string;
  npm: string;
  category: 'CLI' | 'Library' | 'Kit' | 'App';
  scope: 'public' | 'paid';
}

export const PACKAGES: readonly Package[] = [
  {
    slug: 'host-kit',
    name: 'Host Kit',
    npmName: '@bilkobibitkov/host-kit',
    description: 'Shared React component kit used by every bilko.run sibling app.',
    install: 'npm install @bilkobibitkov/host-kit',
    github: 'https://github.com/StanislavBG/bilko-host-kit',
    npm: 'https://www.npmjs.com/package/@bilkobibitkov/host-kit',
    category: 'Kit',
    scope: 'public',
  },
  {
    slug: 'stepproof',
    name: 'Stepproof',
    npmName: 'stepproof',
    description: 'Regression testing for multi-step AI workflows. Not observability — a CI gate.',
    install: 'npm install -g stepproof',
    github: 'https://github.com/StanislavBG/stepproof',
    npm: 'https://www.npmjs.com/package/stepproof',
    category: 'CLI',
    scope: 'public',
  },
  {
    slug: 'bilko-flow',
    name: 'bilko-flow',
    npmName: 'bilko-flow',
    description: 'Deterministic workflows from natural-language goals — for VibeCoders and AI agents.',
    install: 'npm install bilko-flow',
    github: 'https://github.com/StanislavBG/bilko-flow',
    npm: 'https://www.npmjs.com/package/bilko-flow',
    category: 'Library',
    scope: 'public',
  },
  {
    slug: 'session-manager',
    name: 'Session Manager',
    npmName: 'claude-code-session-manager',
    description: 'Electron desktop cockpit for Claude Code CLI — terminal + 17 config tabs.',
    install: 'npm install -g claude-code-session-manager',
    github: 'https://github.com/StanislavBG/session-manager',
    npm: 'https://www.npmjs.com/package/claude-code-session-manager',
    category: 'App',
    scope: 'public',
  },
];
