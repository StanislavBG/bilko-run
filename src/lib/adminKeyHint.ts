export type AdminKeyScope = 'read' | 'registry';

export interface KeySaveHint {
  /** Key file the bilko-host MCP reads for this scope. */
  file: string;
  /** Env var the bilko-host MCP reads before the file. */
  envVar: string;
  /** Shell command that creates the folder and writes the pasted key (stdin) to `file` with mode 600. */
  command: string;
}

const HINTS: Record<AdminKeyScope, { file: string; envVar: string }> = {
  read: { file: '~/.config/bilko-host/admin-key', envVar: 'BILKO_ADMIN_KEY' },
  registry: { file: '~/.config/bilko-host/registry-key', envVar: 'BILKO_REGISTRY_KEY' },
};

/** Where to save a newly created admin API key for the bilko-host MCP, by scope. The key never appears in the command. */
export function keySaveHint(scope: AdminKeyScope): KeySaveHint {
  const { file, envVar } = HINTS[scope];
  return {
    file,
    envVar,
    command: `(umask 077 && mkdir -p ~/.config/bilko-host && cat > ${file})`,
  };
}
