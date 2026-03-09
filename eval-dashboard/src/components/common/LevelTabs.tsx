import clsx from 'clsx';

interface Props {
  activeLevel: number;
  onLevelChange: (level: number) => void;
  levels?: number[];
}

export function LevelTabs({ activeLevel, onLevelChange, levels = [1, 2, 3] }: Props) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
      {levels.map((level) => (
        <button
          key={level}
          onClick={() => onLevelChange(level)}
          className={clsx(
            'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
            activeLevel === level
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          Level {level}
        </button>
      ))}
    </div>
  );
}
