import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Treemap,
  Legend,
} from 'recharts';
import { useEvalData } from '@/hooks/useEvalData';
import { findMisclassificationPairs, computeInputFieldImpact } from '@/utils/stats';
import { LevelTabs } from '@/components/common/LevelTabs';
import { CUBE_COLORS, LEVEL_COLORS } from '@/utils/colors';

export function PatternAnalysisPage() {
  const { filteredTransactions } = useEvalData();
  const [level, setLevel] = useState(1);

  const topPairs = useMemo(
    () => findMisclassificationPairs(filteredTransactions, level).slice(0, 15),
    [filteredTransactions, level],
  );

  const pairChartData = useMemo(
    () =>
      topPairs.map((p) => ({
        name: `${p.expected} → ${p.predicted}`,
        count: p.count,
        cubes: p.cubes,
      })),
    [topPairs],
  );

  const fieldImpact = useMemo(
    () => computeInputFieldImpact(filteredTransactions),
    [filteredTransactions],
  );

  const fieldImpactData = useMemo(
    () =>
      fieldImpact.map((f) => ({
        field: f.field,
        'With Value': f.accuracyWithValue,
        'Without Value': f.accuracyWithoutValue,
      })),
    [fieldImpact],
  );

  // Error breakdown by expected L1/L2
  const errorBreakdown = useMemo(() => {
    const misclassified = filteredTransactions.filter((t) => !t.isExactMatch);
    const groups = new Map<string, { count: number; total: number }>();

    // Group by expected L1
    for (const t of filteredTransactions) {
      const l1 = t.expectedLevels[0]?.toLowerCase() || '(empty)';
      const entry = groups.get(l1) ?? { count: 0, total: 0 };
      entry.total++;
      if (!t.isExactMatch) entry.count++;
      groups.set(l1, entry);
    }

    return Array.from(groups.entries())
      .map(([name, { count, total }]) => ({
        name,
        size: count,
        errorRate: +((count / total) * 100).toFixed(1),
        total,
        fill:
          count / total > 0.7
            ? '#ef4444'
            : count / total > 0.4
              ? '#f59e0b'
              : '#22c55e',
      }))
      .sort((a, b) => b.size - a.size);
  }, [filteredTransactions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Pattern Analysis</h2>
        <LevelTabs activeLevel={level} onLevelChange={setLevel} />
      </div>

      {/* Top Misclassification Pairs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Top Misclassification Pairs (Level {level})
        </h3>
        {pairChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(300, pairChartData.length * 32)}>
            <BarChart data={pairChartData} layout="vertical" margin={{ left: 250 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 10 }}
                width={240}
              />
              <Tooltip />
              <Bar dataKey="count" fill="#ef4444" name="Count" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400 py-8 text-center">
            No misclassifications at this level
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Input Field Impact */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Input Field Impact on Accuracy
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Comparing exact match accuracy when each field is present vs absent/blank
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={fieldImpactData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="field" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend />
              <Bar dataKey="With Value" fill="#22c55e" />
              <Bar dataKey="Without Value" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1">
            {fieldImpact.map((f) => (
              <div key={f.field} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{f.field}</span>
                <span
                  className={
                    f.impactDelta > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'
                  }
                >
                  {f.impactDelta > 0 ? '+' : ''}
                  {f.impactDelta}% when present ({f.withValueCount} txns with,{' '}
                  {f.withoutValueCount} without)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Error Category Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Error Distribution by Expected L1 Category
          </h3>
          <div className="space-y-2">
            {errorBreakdown.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700 font-medium">{cat.name}</span>
                  <span className="text-gray-500">
                    {cat.size} errors / {cat.total} total ({cat.errorRate}% error rate)
                  </span>
                </div>
                <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-red-400"
                    style={{ width: `${cat.errorRate}%` }}
                  />
                  <div
                    className="h-full bg-green-400"
                    style={{ width: `${100 - cat.errorRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed pair breakdown table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Misclassification Pair Details (Level {level})
        </h3>
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Expected</th>
              <th className="text-left p-2">Predicted</th>
              <th className="text-right p-2">Count</th>
              <th className="text-left p-2">Cubes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {topPairs.map((p, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="p-2 font-medium text-gray-700">{p.expected}</td>
                <td className="p-2 text-red-600">{p.predicted}</td>
                <td className="p-2 text-right font-medium">{p.count}</td>
                <td className="p-2">
                  {Object.entries(p.cubes)
                    .map(([cube, count]) => `${cube}(${count})`)
                    .join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
