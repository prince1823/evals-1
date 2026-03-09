import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useEvalData } from '@/hooks/useEvalData';
import { computeLevelAccuracy } from '@/utils/stats';
import { StatCard } from '@/components/common/StatCard';
import { SCORE_COLORS, LEVEL_COLORS } from '@/utils/colors';
import { pct } from '@/utils/format';

export function OverviewPage() {
  const { filteredTransactions, data, filters } = useEvalData();

  const accuracy = useMemo(
    () => computeLevelAccuracy(filteredTransactions),
    [filteredTransactions],
  );

  const bySupplierData = useMemo(() => {
    const groups = new Map<string, typeof filteredTransactions>();
    for (const t of filteredTransactions) {
      const list = groups.get(t.supplierName) ?? [];
      list.push(t);
      groups.set(t.supplierName, list);
    }
    return Array.from(groups.entries())
      .map(([supplier, txns]) => {
        const acc = computeLevelAccuracy(txns);
        return {
          supplier,
          total: txns.length,
          L1: acc.l1.pct,
          L2: acc.l2.pct,
          L3: acc.l3.pct,
          Exact: acc.exact.pct,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions]);

  const scoreDistribution = useMemo(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const t of filteredTransactions) {
      const s = Math.min(t.correctnessScore, 3);
      counts[s] = (counts[s] || 0) + 1;
    }
    return [
      { name: 'L1 Wrong (0)', value: counts[0], color: SCORE_COLORS[0] },
      { name: 'L1 Only (1)', value: counts[1], color: SCORE_COLORS[1] },
      { name: 'L1+L2 (2)', value: counts[2], color: SCORE_COLORS[2] },
      { name: 'Exact (3)', value: counts[3], color: SCORE_COLORS[3] },
    ];
  }, [filteredTransactions]);

  const trendData = useMemo(() => {
    if (!data) return [];
    const points: { run: string; L1: number; L2: number; L3: number; Exact: number }[] = [];
    for (const ts of data.testSets) {
      if (filters.testSet !== 'all' && ts.name !== filters.testSet) continue;
      for (const run of ts.runs) {
        let txns: typeof filteredTransactions = [];
        for (const cube of run.cubes) {
          if (filters.cube !== 'all' && cube.cube !== filters.cube) continue;
          txns.push(...cube.transactions);
        }
        if (txns.length === 0) continue;
        const acc = computeLevelAccuracy(txns);
        points.push({
          run: `${ts.name}/${run.id}`,
          L1: acc.l1.pct,
          L2: acc.l2.pct,
          L3: acc.l3.pct,
          Exact: acc.exact.pct,
        });
      }
    }
    return points;
  }, [data, filters.testSet, filters.cube]);

  const quickInsights = useMemo(() => {
    const insights: string[] = [];
    const total = filteredTransactions.length;
    if (total === 0) return ['No transactions match current filters.'];

    const l1Errors = filteredTransactions.filter((t) => t.correctnessScore === 0);
    const l1ErrorRate = ((l1Errors.length / total) * 100).toFixed(1);
    insights.push(
      `${l1Errors.length} transactions (${l1ErrorRate}%) have L1 errors — the most fundamental misclassifications.`,
    );

    // Find most common L1 misclassification
    const l1Pairs = new Map<string, number>();
    for (const t of l1Errors) {
      const exp = t.expectedLevels[0]?.toLowerCase() || '(empty)';
      const pred = t.predictedLevels[0]?.toLowerCase() || '(empty)';
      const key = `"${exp}" → "${pred}"`;
      l1Pairs.set(key, (l1Pairs.get(key) ?? 0) + 1);
    }
    const topL1 = Array.from(l1Pairs.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topL1) {
      insights.push(`Most common L1 error: ${topL1[0]} (${topL1[1]} times).`);
    }

    // Best and worst suppliers
    const supplierAcc = [...bySupplierData].sort((a, b) => b.Exact - a.Exact);
    if (supplierAcc.length > 1) {
      insights.push(
        `Best performing supplier: ${supplierAcc[0].supplier} (${supplierAcc[0].Exact}% exact). Worst: ${supplierAcc[supplierAcc.length - 1].supplier} (${supplierAcc[supplierAcc.length - 1].Exact}% exact).`,
      );
    }

    // Unknown supplier impact
    const unknownSupplier = filteredTransactions.filter(
      (t) => t.supplierProfile?.confidence === 'low' || !t.supplierProfile,
    );
    if (unknownSupplier.length > 0) {
      const unknownExact = unknownSupplier.filter((t) => t.isExactMatch).length;
      const unknownPct = ((unknownExact / unknownSupplier.length) * 100).toFixed(1);
      insights.push(
        `${unknownSupplier.length} transactions have low/no supplier profile — their exact match rate is only ${unknownPct}%.`,
      );
    }

    return insights;
  }, [filteredTransactions, bySupplierData]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Overview Dashboard</h2>
      <p className="text-sm text-gray-500">
        {filteredTransactions.length.toLocaleString()} transactions across{' '}
        {new Set(filteredTransactions.map((t) => t.supplierName)).size} suppliers
      </p>

      {/* Accuracy Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="L1 Accuracy"
          value={pct(accuracy.l1.pct)}
          subtitle={`${accuracy.l1.correct} / ${accuracy.l1.total}`}
          color="blue"
        />
        <StatCard
          label="L2 Accuracy"
          value={pct(accuracy.l2.pct)}
          subtitle={`${accuracy.l2.correct} / ${accuracy.l2.total}`}
          color="purple"
        />
        <StatCard
          label="L3 Accuracy"
          value={pct(accuracy.l3.pct)}
          subtitle={`${accuracy.l3.correct} / ${accuracy.l3.total}`}
          color="amber"
        />
        <StatCard
          label="Exact Match"
          value={pct(accuracy.exact.pct)}
          subtitle={`${accuracy.exact.correct} / ${accuracy.exact.total}`}
          color="green"
        />
      </div>

      {/* Score Distribution */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Correctness Score Distribution
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={scoreDistribution}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {scoreDistribution.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Accuracy by Supplier */}
      <SupplierAccuracyTable data={bySupplierData} />

      {/* Accuracy Trend */}
      {trendData.length > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Accuracy Trend Across Runs</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="run" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend />
              <Line type="monotone" dataKey="L1" stroke={LEVEL_COLORS.l1} strokeWidth={2} />
              <Line type="monotone" dataKey="L2" stroke={LEVEL_COLORS.l2} strokeWidth={2} />
              <Line type="monotone" dataKey="L3" stroke={LEVEL_COLORS.l3} strokeWidth={2} />
              <Line type="monotone" dataKey="Exact" stroke={LEVEL_COLORS.exact} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quick Insights */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Key Insights</h3>
        <ul className="space-y-2">
          {quickInsights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-blue-500 font-bold mt-0.5">-</span>
              {insight}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Accuracy cell color ── */
function accBg(v: number): string {
  if (v === 100) return 'bg-green-100 text-green-800';
  if (v >= 80) return 'bg-green-50 text-green-700';
  if (v >= 50) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

type SortKey = 'supplier' | 'total' | 'L1' | 'L2' | 'L3' | 'Exact';

function SupplierAccuracyTable({
  data,
}: {
  data: { supplier: string; total: number; L1: number; L2: number; L3: number; Exact: number }[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string')
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return copy;
  }, [data, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />) : null;

  const cols: { key: SortKey; label: string }[] = [
    { key: 'supplier', label: 'Supplier' },
    { key: 'total', label: 'Txns' },
    { key: 'L1', label: 'L1' },
    { key: 'L2', label: 'L2' },
    { key: 'L3', label: 'L3' },
    { key: 'Exact', label: 'Exact' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Accuracy by Supplier
        <span className="text-xs font-normal text-gray-400 ml-2">({data.length} suppliers — click headers to sort)</span>
      </h3>
      <div className="overflow-auto max-h-[420px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  onClick={() => handleSort(c.key)}
                  className={`px-3 py-2 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none ${c.key !== 'supplier' ? 'text-center' : ''}`}
                >
                  {c.label}
                  <SortIcon col={c.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((row) => (
              <tr key={row.supplier} className="hover:bg-gray-50">
                <td className="px-3 py-1.5 text-gray-800 font-medium truncate max-w-[220px]" title={row.supplier}>
                  {row.supplier}
                </td>
                <td className="px-3 py-1.5 text-center text-gray-500">{row.total}</td>
                {(['L1', 'L2', 'L3', 'Exact'] as const).map((lev) => (
                  <td key={lev} className="px-3 py-1.5 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${accBg(row[lev])}`}>
                      {row[lev]}%
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
