/** Grade color for dark backgrounds (e.g. ScoreCard) */
export function gradeColorLight(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-400';
  if (grade.startsWith('B')) return 'text-blue-400';
  if (grade.startsWith('C')) return 'text-yellow-400';
  if (grade === 'D') return 'text-orange-400';
  return 'text-red-400';
}

/** Grade color for white backgrounds (e.g. CompareCard, tables) */
export function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-700';
  if (grade.startsWith('B')) return 'text-blue-700';
  if (grade.startsWith('C')) return 'text-yellow-700';
  if (grade === 'D') return 'text-orange-700';
  return 'text-red-700';
}

/** Grade badge background + text for inline badges */
export function gradeBadge(grade: string): string {
  if (grade.startsWith('A')) return 'bg-green-100 text-green-700';
  if (grade.startsWith('B')) return 'bg-blue-100 text-blue-700';
  if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-700';
  if (grade === 'D') return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

/** Score bar color based on percentage */
export function barColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 60) return 'bg-blue-500';
  if (pct >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}
