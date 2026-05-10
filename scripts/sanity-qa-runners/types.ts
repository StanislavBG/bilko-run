export interface SanityTarget {
  slug: string;
  name: string;
  url: string;
  category: string;
  localPublicPath: string; // absolute path to public/projects/<slug>/
  localSourcePath?: string; // expanded ~/Projects/... path for git checks
}

export interface Finding {
  severity: 'critical' | 'high' | 'med' | 'low';
  target: string;
  kind: string;
  detail: string;
}

export type TargetStatus = 'pass' | 'warn' | 'fail' | 'skip' | 'error';

export interface SubagentResult {
  name: 'smoke' | 'security' | 'perf' | 'size' | 'a11y';
  status: TargetStatus;
  perTarget: Record<string, TargetStatus>;
  details: string;
  findings?: Finding[];
  sectionMd: string;
}
