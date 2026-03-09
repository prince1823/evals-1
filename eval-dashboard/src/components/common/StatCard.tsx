import clsx from 'clsx';

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
  delta?: number;
}

export function StatCard({ label, value, subtitle, color = 'blue', delta }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    blue: 'border-l-blue-500',
    purple: 'border-l-purple-500',
    amber: 'border-l-amber-500',
    green: 'border-l-green-500',
    red: 'border-l-red-500',
  };

  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 p-4',
        colorClasses[color] || colorClasses.blue,
      )}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {delta != null && (
          <span
            className={clsx(
              'text-sm font-medium',
              delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-500',
            )}
          >
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
