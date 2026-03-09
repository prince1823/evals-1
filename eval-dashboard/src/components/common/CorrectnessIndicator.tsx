import clsx from 'clsx';
import { SCORE_BG_CLASSES } from '@/utils/colors';

interface Props {
  score: number;
  maxLevel?: number;
}

export function CorrectnessIndicator({ score, maxLevel = 3 }: Props) {
  const labels: Record<number, string> = {
    0: 'L1 Wrong',
    1: 'L1 Only',
    2: 'L1+L2',
    3: 'Exact',
  };

  const label = score >= maxLevel ? 'Exact' : labels[score] ?? `${score}`;
  const colorClass = score >= maxLevel ? SCORE_BG_CLASSES[3] : (SCORE_BG_CLASSES[score] ?? SCORE_BG_CLASSES[0]);

  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colorClass)}>
      {label}
    </span>
  );
}
