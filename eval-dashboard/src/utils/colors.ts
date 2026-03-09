export const CUBE_COLORS: Record<string, string> = {
  fox: '#3b82f6',
  innova: '#10b981',
  lifepoint: '#f59e0b',
  sp_global: '#8b5cf6',
};

export const SCORE_COLORS: Record<number, string> = {
  0: '#ef4444',
  1: '#f97316',
  2: '#eab308',
  3: '#22c55e',
};

export const SCORE_BG_CLASSES: Record<number, string> = {
  0: 'bg-red-100 text-red-800',
  1: 'bg-orange-100 text-orange-800',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-green-100 text-green-800',
};

export const LEVEL_COLORS = {
  l1: '#3b82f6',
  l2: '#8b5cf6',
  l3: '#f59e0b',
  exact: '#22c55e',
};

export function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function heatmapColor(value: number, max: number, isCorrect: boolean): string {
  if (max === 0) return 'rgba(0,0,0,0)';
  const alpha = Math.min(0.9, 0.1 + (value / max) * 0.8);
  if (isCorrect) return `rgba(34, 197, 94, ${alpha})`;
  return `rgba(239, 68, 68, ${alpha})`;
}
