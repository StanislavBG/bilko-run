export type TimelineItem =
  | { ts: number; kind: 'view'; path: string; referrer: string | null }
  | { ts: number; kind: 'click'; path: string; label: string | null; href: string | null; track_name: string | null }
  | { ts: number; kind: 'event'; name: string; app: string | null; path: string | null; props: unknown }
  | { ts: number; kind: 'error'; app: string; name: string | null; msg: string; url: string | null };
