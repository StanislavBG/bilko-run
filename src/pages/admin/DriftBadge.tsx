export type DriftStatus = 'current' | 'minor_behind' | 'major_behind' | 'unknown';

const BADGES: Record<DriftStatus, { color: string; label: string }> = {
  current: { color: 'bg-green-100 text-green-700', label: 'current' },
  minor_behind: { color: 'bg-yellow-100 text-yellow-700', label: '-1 minor' },
  major_behind: { color: 'bg-red-100 text-red-700', label: 'outdated' },
  unknown: { color: 'bg-warm-100 text-warm-500', label: 'unknown' },
};

export function DriftBadge({ drift }: { drift: DriftStatus }) {
  const { color, label } = BADGES[drift] ?? BADGES.unknown;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{label}</span>;
}
