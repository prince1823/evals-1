import { useMemo, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts';
import { useEvalData } from '@/hooks/useEvalData';
import { aggregateBySupplier } from '@/utils/stats';
import { getConfidenceColor, CUBE_COLORS } from '@/utils/colors';
import { pct } from '@/utils/format';
import clsx from 'clsx';

export function SupplierAnalysisPage() {
  const { filteredTransactions } = useEvalData();
  const [sortCol, setSortCol] = useState<'total' | 'l1' | 'l2' | 'l3' | 'exact'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const suppliers = useMemo(() => {
    const agg = aggregateBySupplier(filteredTransactions);
    return agg.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'total') cmp = a.totalTransactions - b.totalTransactions;
      else if (sortCol === 'l1') cmp = a.l1Accuracy - b.l1Accuracy;
      else if (sortCol === 'l2') cmp = a.l2Accuracy - b.l2Accuracy;
      else if (sortCol === 'l3') cmp = a.l3Accuracy - b.l3Accuracy;
      else if (sortCol === 'exact') cmp = (a.exactMatchCount / a.totalTransactions) - (b.exactMatchCount / b.totalTransactions);
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [filteredTransactions, sortCol, sortDir]);

  const confidenceData = useMemo(() => {
    const groups: Record<string, { total: number; exact: number; count: number }> = {};
    for (const s of suppliers) {
      const conf = s.profileConfidence || 'unknown';
      if (!groups[conf]) groups[conf] = { total: 0, exact: 0, count: 0 };
      groups[conf].total += s.totalTransactions;
      groups[conf].exact += s.exactMatchCount;
      groups[conf].count++;
    }
    return Object.entries(groups).map(([conf, vals]) => ({
      confidence: conf,
      accuracy: +((vals.exact / vals.total) * 100).toFixed(1),
      transactions: vals.total,
      suppliers: vals.count,
    }));
  }, [suppliers]);

  const unknownSuppliers = useMemo(() => {
    return suppliers.filter((s) => !s.isKnown);
  }, [suppliers]);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Supplier Analysis</h2>
      <p className="text-sm text-gray-500">
        {suppliers.length} unique suppliers across {filteredTransactions.length} transactions
      </p>

      {/* Confidence vs Accuracy */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Supplier Confidence vs Exact Match Accuracy
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={confidenceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="confidence" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
              <Tooltip
                formatter={(v: number) => `${v}%`}
                labelFormatter={(l) => `Confidence: ${l}`}
              />
              <Bar dataKey="accuracy" fill="#3b82f6" name="Exact Match %" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 text-xs text-gray-500 text-center">
            {confidenceData.map((d) => (
              <span key={d.confidence} className="mx-2">
                {d.confidence}: {d.suppliers} suppliers, {d.transactions} txns
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Unknown/Low-Confidence Suppliers ({unknownSuppliers.length})
          </h3>
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-2">Supplier</th>
                  <th className="text-left p-2">Cube</th>
                  <th className="text-right p-2">Txns</th>
                  <th className="text-right p-2">Exact %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unknownSuppliers.slice(0, 30).map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="p-2 max-w-[150px] truncate">{s.supplierName}</td>
                    <td className="p-2">{s.cube}</td>
                    <td className="p-2 text-right">{s.totalTransactions}</td>
                    <td className="p-2 text-right">
                      {pct((s.exactMatchCount / s.totalTransactions) * 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Supplier Accuracy Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left p-3 text-xs font-medium text-gray-500">Supplier</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500">Cube</th>
              <th
                className="text-right p-3 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('total')}
              >
                Txns {sortCol === 'total' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="text-right p-3 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('l1')}
              >
                L1 Acc {sortCol === 'l1' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="text-right p-3 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('l2')}
              >
                L2 Acc {sortCol === 'l2' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="text-right p-3 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('l3')}
              >
                L3 Acc {sortCol === 'l3' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="text-right p-3 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('exact')}
              >
                Exact {sortCol === 'exact' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-center p-3 text-xs font-medium text-gray-500">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {suppliers.slice(0, 100).map((s, i) => {
              const exactPct = (s.exactMatchCount / s.totalTransactions) * 100;
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="p-3 max-w-[180px] truncate text-xs" title={s.supplierName}>
                    {s.supplierName}
                  </td>
                  <td className="p-3 text-xs">{s.cube}</td>
                  <td className="p-3 text-right text-xs">{s.totalTransactions}</td>
                  <td className="p-3 text-right text-xs">
                    <AccuracyBar value={s.l1Accuracy} />
                  </td>
                  <td className="p-3 text-right text-xs">
                    <AccuracyBar value={s.l2Accuracy} />
                  </td>
                  <td className="p-3 text-right text-xs">
                    <AccuracyBar value={s.l3Accuracy} />
                  </td>
                  <td className="p-3 text-right text-xs">
                    <AccuracyBar value={exactPct} />
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        getConfidenceColor(s.profileConfidence),
                      )}
                    >
                      {s.profileConfidence}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {suppliers.length > 100 && (
          <p className="text-xs text-gray-400 text-center py-2">
            Showing top 100 of {suppliers.length} suppliers
          </p>
        )}
      </div>
    </div>
  );
}

function AccuracyBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full',
            value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500',
          )}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-[11px] w-12 text-right">{pct(value)}</span>
    </div>
  );
}
