import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface PathBreadcrumbProps {
  levels: string[];
  compareWith?: string[];
  className?: string;
}

export function PathBreadcrumb({ levels, compareWith, className }: PathBreadcrumbProps) {
  if (!levels.length) return <span className="text-gray-400 text-xs italic">empty</span>;

  return (
    <div className={clsx('flex items-center gap-0.5 flex-wrap', className)}>
      {levels.map((level, i) => {
        const isMatch = compareWith
          ? compareWith[i]?.toLowerCase() === level.toLowerCase()
          : true;
        return (
          <Fragment key={i}>
            {i > 0 && <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />}
            <span
              className={clsx(
                'rounded px-1.5 py-0.5 text-xs whitespace-nowrap',
                isMatch
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800 font-medium',
              )}
            >
              {level}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
