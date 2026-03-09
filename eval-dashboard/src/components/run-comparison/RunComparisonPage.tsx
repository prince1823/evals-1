import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useEvalData } from '@/hooks/useEvalData';
import { computeLevelAccuracy } from '@/utils/stats';
import { StatCard } from '@/components/common/StatCard';
import { PathBreadcrumb } from '@/components/common/PathBreadcrumb';
import { CorrectnessIndicator } from '@/components/common/CorrectnessIndicator';
import type { Transaction, Run } from '@/types/data';
import { pct } from '@/utils/format';

interface TransactionDelta {
  baseline: Transaction;
  compare: Transaction;
  scoreDelta: number;
}

export function RunComparisonPage() {
  const { data } = useEvalData();
  const [baselineRunKey, setBaselineRunKey] = useState('');
  const [compareRunKey, setCompareRunKey] = useState('');

  const allRuns = useMemo(() => {
    if (!data) return [];
    const runs: { key: string; label: string; run: Run }[] = [];
    for (const ts of data.testSets) {
      for (const run of ts.runs) {
        runs.push({
          key: `${ts.name}|||${run.id}`,
          label: `${ts.name} / ${run.id}`,
          run,
        });
      }
    }
    return runs;
  }, [data]);

  const baselineRun = allRuns.find((r) => r.key === baselineRunKey)?.run;
  const compareRun = allRuns.find((r) => r.key === compareRunKey)?.run;

  const comparison = useMemo(() => {
    if (!baselineRun || !compareRun) return null;

    const baselineTxns: Transaction[] = [];
    const compareTxns: Transaction[] = [];
    for (const c of baselineRun.cubes) baselineTxns.push(...c.transactions);
    for (const c of compareRun.cubes) compareTxns.push(...c.transactions);

    const baselineAcc = computeLevelAccuracy(baselineTxns);
    const compareAcc = computeLevelAccuracy(compareTxns);

    // Match transactions by cube:rowIndex
    const baselineMap = new Map<string, Transaction>();
    for (const t of baselineTxns) {
      baselineMap.set(`${t.cube}:${t.rowIndex}`, t);
    }

    const improvements: TransactionDelta[] = [];
    const regressions: TransactionDelta[] = [];

    for (const t of compareTxns) {
      const bt = baselineMap.get(`${t.cube}:${t.rowIndex}`);
      if (!bt) continue;
      const delta = t.correctnessScore - bt.correctnessScore;
      if (delta > 0) improvements.push({ baseline: bt, compare: t, scoreDelta: delta });
      else if (delta < 0) regressions.push({ baseline: bt, compare: t, scoreDelta: delta });
    }

    // Per-cube comparison
    const cubes = new Set([
      ...baselineRun.cubes.map((c) => c.cube),
      ...compareRun.cubes.map((c) => c.cube),
    ]);
    const perCube = Array.from(cubes).map((cube) => {
      const bTxns = baselineTxns.filter((t) => t.cube === cube);
      const cTxns = compareTxns.filter((t) => t.cube === cube);
      const bAcc = computeLevelAccuracy(bTxns);
      const cAcc = computeLevelAccuracy(cTxns);
      return {
        cube,
        'Baseline Exact': bAcc.exact.pct,
        'Compare Exact': cAcc.exact.pct,
        'Baseline L1': bAcc.l1.pct,
        'Compare L1': cAcc.l1.pct,
      };
    });

    return {
      baselineAcc,
      compareAcc,
      improvements: improvements.sort((a, b) => b.scoreDelta - a.scoreDelta),
      regressions: regressions.sort((a, b) => a.scoreDelta - b.scoreDelta),
      perCube,
    };
  }, [baselineRun, compareRun]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Run Comparison</h2>

      {/* Run Selectors */}
      <div className="flex items-center gap-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Baseline:</label>
          <select
            value={baselineRunKey}
            onChange={(e) => setBaselineRunKey(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
          >
            <option value="">Select run...</option>
            {allRuns.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <span className="text-gray-400">vs</span>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Compare:</label>
          <select
            value={compareRunKey}
            onChange={(e) => setCompareRunKey(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
          >
            <option value="">Select run...</option>
            {allRuns.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!comparison && (
        <p className="text-sm text-gray-400 text-center py-12">
          Select two runs above to compare their results.
        </p>
      )}

      {comparison && (
        <>
          {/* Delta Cards */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="L1 Accuracy"
              value={pct(comparison.compareAcc.l1.pct)}
              delta={+(comparison.compareAcc.l1.pct - comparison.baselineAcc.l1.pct).toFixed(1)}
              color="blue"
              subtitle={`Baseline: ${pct(comparison.baselineAcc.l1.pct)}`}
            />
            <StatCard
              label="L2 Accuracy"
              value={pct(comparison.compareAcc.l2.pct)}
              delta={+(comparison.compareAcc.l2.pct - comparison.baselineAcc.l2.pct).toFixed(1)}
              color="purple"
              subtitle={`Baseline: ${pct(comparison.baselineAcc.l2.pct)}`}
            />
            <StatCard
              label="L3 Accuracy"
              value={pct(comparison.compareAcc.l3.pct)}
              delta={+(comparison.compareAcc.l3.pct - comparison.baselineAcc.l3.pct).toFixed(1)}
              color="amber"
              subtitle={`Baseline: ${pct(comparison.baselineAcc.l3.pct)}`}
            />
            <StatCard
              label="Exact Match"
              value={pct(comparison.compareAcc.exact.pct)}
              delta={
                +(comparison.compareAcc.exact.pct - comparison.baselineAcc.exact.pct).toFixed(1)
              }
              color="green"
              subtitle={`Baseline: ${pct(comparison.baselineAcc.exact.pct)}`}
            />
          </div>

          {/* Per-cube chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Per-Cube Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparison.perCube}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="cube" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend />
                <Bar dataKey="Baseline Exact" fill="#94a3b8" />
                <Bar dataKey="Compare Exact" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Improvements */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-green-700 mb-3">
                Improvements ({comparison.improvements.length})
              </h3>
              <DeltaTable deltas={comparison.improvements.slice(0, 25)} type="improvement" />
            </div>

            {/* Regressions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-red-700 mb-3">
                Regressions ({comparison.regressions.length})
              </h3>
              <DeltaTable deltas={comparison.regressions.slice(0, 25)} type="regression" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DeltaTable({
  deltas,
  type,
}: {
  deltas: TransactionDelta[];
  type: 'improvement' | 'regression';
}) {
  if (deltas.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">None</p>;
  }

  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="text-left p-2">Supplier</th>
            <th className="text-left p-2">Cube</th>
            <th className="text-center p-2">Before</th>
            <th className="text-center p-2">After</th>
            <th className="text-left p-2">Expected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {deltas.map((d, i) => (
            <tr
              key={i}
              className={type === 'regression' ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-green-50/50'}
            >
              <td className="p-2 max-w-[100px] truncate">{d.baseline.supplierName}</td>
              <td className="p-2">{d.baseline.cube}</td>
              <td className="p-2 text-center">
                <CorrectnessIndicator score={d.baseline.correctnessScore} />
              </td>
              <td className="p-2 text-center">
                <CorrectnessIndicator score={d.compare.correctnessScore} />
              </td>
              <td className="p-2">
                <PathBreadcrumb levels={d.baseline.expectedLevels} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
