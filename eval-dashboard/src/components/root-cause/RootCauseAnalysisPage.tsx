import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { useEvalData } from '@/hooks/useEvalData';
import { StatCard } from '@/components/common/StatCard';
import { PathBreadcrumb } from '@/components/common/PathBreadcrumb';
import { SCORE_COLORS } from '@/utils/colors';
import { truncate } from '@/utils/format';
import { ArrowRight } from 'lucide-react';
import {
  categorizeRootCauses,
  getSupplierErrorConcentration,
  getMissingProfileStats,
  type RootCause,
} from '@/utils/rootCause';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  major: '#f97316',
  minor: '#eab308',
};

const SEVERITY_BG: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  major: 'bg-orange-100 text-orange-800',
  minor: 'bg-yellow-100 text-yellow-800',
};

export function RootCauseAnalysisPage() {
  const { filteredTransactions } = useEvalData();
  const [expandedCause, setExpandedCause] = useState<string | null>(null);
  const [expandedTransactions, setExpandedTransactions] = useState<string | null>(null);

  const misclassified = useMemo(
    () => filteredTransactions.filter((t) => !t.isExactMatch),
    [filteredTransactions],
  );

  const rootCauses = useMemo(
    () => categorizeRootCauses(filteredTransactions),
    [filteredTransactions],
  );

  const supplierConcentration = useMemo(
    () => getSupplierErrorConcentration(filteredTransactions),
    [filteredTransactions],
  );

  const profileStats = useMemo(
    () => getMissingProfileStats(filteredTransactions),
    [filteredTransactions],
  );

  const errorLevelCounts = useMemo(() => {
    const l1 = misclassified.filter((t) => t.correctnessScore === 0).length;
    const l2 = misclassified.filter((t) => t.correctnessScore === 1).length;
    const l3 = misclassified.filter((t) => t.correctnessScore === 2).length;
    return { l1, l2, l3 };
  }, [misclassified]);

  const l3Pct =
    misclassified.length > 0
      ? ((errorLevelCounts.l3 / misclassified.length) * 100).toFixed(0)
      : '0';

  const rootCauseChartData = rootCauses.map((rc) => ({
    name: rc.name,
    count: rc.count,
    severity: rc.severity,
  }));

  const supplierChartData = supplierConcentration.slice(0, 10).map((s) => ({
    name: truncate(s.supplier, 25),
    count: s.count,
    fullName: s.supplier,
  }));

  if (misclassified.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900">Root Cause Analysis</h2>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-800 font-medium">No misclassifications found!</p>
          <p className="text-green-600 text-sm mt-1">
            All {filteredTransactions.length} transactions are exactly matched.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Root Cause Analysis</h2>
        <p className="text-sm text-gray-500 mt-1">
          {misclassified.length} misclassified transactions analyzed across{' '}
          {new Set(misclassified.map((t) => t.supplierName)).size} suppliers
        </p>
      </div>

      {/* Section 1: Error Level Summary */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="L1 Errors (Score 0)"
          value={String(errorLevelCounts.l1)}
          subtitle="Wrong top-level domain"
          color="red"
        />
        <StatCard
          label="L2 Errors (Score 1)"
          value={String(errorLevelCounts.l2)}
          subtitle="Wrong category"
          color="amber"
        />
        <StatCard
          label="L3 Errors (Score 2)"
          value={String(errorLevelCounts.l3)}
          subtitle="Wrong subcategory"
          color="purple"
        />
      </div>

      {errorLevelCounts.l3 > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">{l3Pct}% of all errors are L3-level</span> — the
            system is strong at broad categorization but struggles with fine-grained L3
            distinctions. Focus on improving L3 taxonomy mapping for the highest impact.
          </p>
        </div>
      )}

      {/* Section 2: Charts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Root Cause Distribution</h3>
        <ResponsiveContainer width="100%" height={Math.max(200, rootCauseChartData.length * 50)}>
          <BarChart data={rootCauseChartData} layout="vertical" margin={{ left: 20, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={200} />
            <Tooltip />
            <Bar dataKey="count" name="Errors" barSize={24}>
              {rootCauseChartData.map((entry, i) => (
                <Cell key={i} fill={SEVERITY_COLORS[entry.severity] || '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Errors by Supplier (Top {Math.min(supplierChartData.length, 10)})
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(200, supplierChartData.length * 40)}>
          <BarChart data={supplierChartData} layout="vertical" margin={{ left: 20, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={200} />
            <Tooltip
              formatter={(value: number) => [`${value} errors`, 'Count']}
              labelFormatter={(_: string, payload: any[]) =>
                payload?.[0]?.payload?.fullName || ''
              }
            />
            <Bar dataKey="count" fill="#6366f1" name="Errors" barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Section 3: Root Cause Detail Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Root Cause Details</h3>
        {rootCauses.map((rc) => (
          <RootCauseCard
            key={rc.id}
            rootCause={rc}
            isExpanded={expandedCause === rc.id}
            onToggle={() => setExpandedCause(expandedCause === rc.id ? null : rc.id)}
            showTransactions={expandedTransactions === rc.id}
            onToggleTransactions={() =>
              setExpandedTransactions(expandedTransactions === rc.id ? null : rc.id)
            }
          />
        ))}
      </div>

      {/* Section 4: Missing Supplier Profile Alert */}
      {profileStats.missingProfileCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Missing Supplier Profiles — {profileStats.missingProfileCount}/
                {profileStats.misclassifiedTotal} misclassified transactions
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                {profileStats.uniqueSuppliersWithoutProfile.length} unique supplier(s) lack
                profiles. Adding supplier profiles with correct category mappings would likely
                reduce misclassification rates.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profileStats.uniqueSuppliersWithoutProfile.map((s) => (
                  <span
                    key={s}
                    className="inline-block bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 5: Actionable Recommendations */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Actionable Recommendations (ranked by impact)
        </h3>
        <ol className="space-y-3">
          {rootCauses.map((rc, i) => (
            <li key={rc.id} className="flex items-start gap-3 text-sm">
              <span className="bg-blue-100 text-blue-800 font-bold rounded-full h-6 w-6 flex items-center justify-center shrink-0 text-xs">
                {i + 1}
              </span>
              <div>
                <span className="font-medium text-gray-900">{rc.name}</span>
                <span className="text-gray-400 mx-1">({rc.count} errors)</span>
                <p className="text-gray-600 mt-0.5">{rc.suggestedFix}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function RootCauseCard({
  rootCause: rc,
  isExpanded,
  onToggle,
  showTransactions,
  onToggleTransactions,
}: {
  rootCause: RootCause;
  isExpanded: boolean;
  onToggle: () => void;
  showTransactions: boolean;
  onToggleTransactions: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        )}
        <div className="flex-1 flex items-center gap-3">
          <h4 className="text-sm font-semibold text-gray-900">{rc.name}</h4>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SEVERITY_BG[rc.severity]}`}>
            {rc.severity}
          </span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {rc.errorLevel} error
          </span>
        </div>
        <span className="text-sm font-bold text-gray-700">
          {rc.count} error{rc.count > 1 ? 's' : ''}{' '}
          <span className="font-normal text-gray-400">({rc.percentage.toFixed(0)}%)</span>
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4">
          {/* Description */}
          <p className="text-sm text-gray-600">{rc.description}</p>

          {/* Supplier Breakdown with counts */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">
              Affected Suppliers ({rc.supplierBreakdown.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {rc.supplierBreakdown.map((s) => (
                <span
                  key={s.supplier}
                  className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded"
                >
                  <span className="font-medium">{s.supplier}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{s.count.toLocaleString()} errors</span>
                </span>
              ))}
            </div>
          </div>

          {/* Example Paths */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Expected</p>
              <PathBreadcrumb
                levels={rc.transactions[0]?.expectedLevels ?? []}
                compareWith={rc.transactions[0]?.predictedLevels}
              />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Predicted</p>
              <PathBreadcrumb
                levels={rc.transactions[0]?.predictedLevels ?? []}
                compareWith={rc.transactions[0]?.expectedLevels}
              />
            </div>
          </div>

          {/* Top Confusion Pairs */}
          {rc.topConfusionPairs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                Error Pattern Breakdown
              </p>
              <div className="space-y-1.5">
                {rc.topConfusionPairs.map((pair, i) => {
                  const pct = rc.count > 0 ? ((pair.count / rc.count) * 100).toFixed(0) : '0';
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2 text-xs"
                    >
                      <span className="font-mono text-green-700 truncate max-w-[35%]" title={pair.expected}>
                        {pair.expected}
                      </span>
                      <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
                      <span className="font-mono text-red-600 truncate max-w-[35%]" title={pair.predicted}>
                        {pair.predicted}
                      </span>
                      <span className="ml-auto shrink-0 text-gray-500 font-medium">
                        {pair.count.toLocaleString()} <span className="text-gray-400">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggested Fix */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs font-medium text-green-800 uppercase mb-1">Suggested Fix</p>
            <p className="text-sm text-green-700">{rc.suggestedFix}</p>
          </div>

          {/* Transaction List Toggle */}
          <div>
            <button
              onClick={onToggleTransactions}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              {showTransactions ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {showTransactions ? 'Hide' : 'Show'} all {rc.count} affected transactions
            </button>

            {showTransactions && (
              <div className="mt-2 overflow-auto max-h-64 border border-gray-200 rounded">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-gray-500 font-medium">Row</th>
                      <th className="px-2 py-1.5 text-left text-gray-500 font-medium">
                        Supplier
                      </th>
                      <th className="px-2 py-1.5 text-left text-gray-500 font-medium">
                        Line Description
                      </th>
                      <th className="px-2 py-1.5 text-left text-gray-500 font-medium">
                        Expected
                      </th>
                      <th className="px-2 py-1.5 text-left text-gray-500 font-medium">
                        Predicted
                      </th>
                      <th className="px-2 py-1.5 text-center text-gray-500 font-medium">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rc.transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 text-gray-500">{t.rowIndex}</td>
                        <td className="px-2 py-1.5 text-gray-700 max-w-[120px] truncate">
                          {t.supplierName}
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 max-w-[150px] truncate">
                          {t.lineDescription}
                        </td>
                        <td className="px-2 py-1.5 text-gray-700 max-w-[180px] truncate">
                          {t.expectedPath}
                        </td>
                        <td className="px-2 py-1.5 text-red-600 max-w-[180px] truncate">
                          {t.predictedPath}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span
                            className="inline-block w-5 h-5 rounded-full text-white text-[10px] font-bold leading-5"
                            style={{ backgroundColor: SCORE_COLORS[t.correctnessScore] }}
                          >
                            {t.correctnessScore}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
