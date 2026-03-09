import React, { useState, useMemo } from 'react';
import { useEvalData } from '@/hooks/useEvalData';
import { PathBreadcrumb } from '@/components/common/PathBreadcrumb';
import { CorrectnessIndicator } from '@/components/common/CorrectnessIndicator';
import { getConfidenceColor } from '@/utils/colors';
import { truncate, formatAmount } from '@/utils/format';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';

export function MisclassificationsPage() {
  const { filteredTransactions } = useEvalData();
  const [scoreFilter, setScoreFilter] = useState<number[]>([0, 1, 2]);
  const [sortBy, setSortBy] = useState<'score' | 'supplier' | 'cube'>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailTransaction, setDetailTransaction] = useState<
    (typeof filteredTransactions)[0] | null
  >(null);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const misclassified = useMemo(() => {
    let txns = filteredTransactions.filter((t) => scoreFilter.includes(Math.min(t.correctnessScore, 3)));

    txns.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'score') cmp = a.correctnessScore - b.correctnessScore;
      else if (sortBy === 'supplier') cmp = a.supplierName.localeCompare(b.supplierName);
      else if (sortBy === 'cube') cmp = a.cube.localeCompare(b.cube);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return txns;
  }, [filteredTransactions, scoreFilter, sortBy, sortDir]);

  const pageCount = Math.ceil(misclassified.length / pageSize);
  const pagedData = misclassified.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Misclassification Deep Dive</h2>

      {/* Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500 mr-1">Filter:</span>

        {/* L1 Wrong */}
        <button
          onClick={() => {
            setScoreFilter([0]);
            setPage(0);
          }}
          className={clsx(
            'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
            scoreFilter.length === 1 && scoreFilter[0] === 0
              ? 'bg-red-600 text-white border-red-600 shadow-sm'
              : 'bg-white text-red-700 border-red-300 hover:bg-red-50',
          )}
        >
          L1 Wrong
        </button>

        {/* L2 Wrong */}
        <button
          onClick={() => {
            setScoreFilter([1]);
            setPage(0);
          }}
          className={clsx(
            'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
            scoreFilter.length === 1 && scoreFilter[0] === 1
              ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
              : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50',
          )}
        >
          L2 Wrong
        </button>

        {/* L3 Wrong */}
        <button
          onClick={() => {
            setScoreFilter([2]);
            setPage(0);
          }}
          className={clsx(
            'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
            scoreFilter.length === 1 && scoreFilter[0] === 2
              ? 'bg-yellow-600 text-white border-yellow-600 shadow-sm'
              : 'bg-white text-yellow-700 border-yellow-300 hover:bg-yellow-50',
          )}
        >
          L3 Wrong
        </button>

        {/* Exact Match */}
        <button
          onClick={() => {
            setScoreFilter([3]);
            setPage(0);
          }}
          className={clsx(
            'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
            scoreFilter.length === 1 && scoreFilter[0] === 3
              ? 'bg-green-600 text-white border-green-600 shadow-sm'
              : 'bg-white text-green-700 border-green-300 hover:bg-green-50',
          )}
        >
          Exact Match
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* All Level Wrong */}
        <button
          onClick={() => {
            setScoreFilter([0, 1, 2]);
            setPage(0);
          }}
          className={clsx(
            'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
            scoreFilter.length === 3 &&
              scoreFilter.includes(0) &&
              scoreFilter.includes(1) &&
              scoreFilter.includes(2)
              ? 'bg-gray-800 text-white border-gray-800 shadow-sm'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
          )}
        >
          All Wrong
        </button>

        <span className="ml-auto text-sm text-gray-500">
          {misclassified.length} transactions
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-8 p-2" />
              <th className="text-left p-2 text-xs font-medium text-gray-500">Row</th>
              <th
                className="text-left p-2 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('cube')}
              >
                Cube {sortBy === 'cube' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="text-left p-2 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('supplier')}
              >
                Supplier {sortBy === 'supplier' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left p-2 text-xs font-medium text-gray-500">Line Description</th>
              <th className="text-left p-2 text-xs font-medium text-gray-500">Expected</th>
              <th className="text-left p-2 text-xs font-medium text-gray-500">Predicted</th>
              <th
                className="text-left p-2 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('score')}
              >
                Score {sortBy === 'score' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left p-2 text-xs font-medium text-gray-500">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagedData.map((t) => (
              <React.Fragment key={t.id}>
                <tr
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                >
                  <td className="p-2 text-gray-400">
                    {expandedId === t.id ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </td>
                  <td className="p-2 text-gray-500 text-xs">{t.rowIndex}</td>
                  <td className="p-2 text-xs">{t.cube}</td>
                  <td className="p-2 max-w-[140px] truncate text-xs" title={t.supplierName}>
                    {truncate(t.supplierName, 30)}
                  </td>
                  <td className="p-2 max-w-[160px] truncate text-xs" title={t.lineDescription}>
                    {truncate(t.lineDescription, 35)}
                  </td>
                  <td className="p-2">
                    <PathBreadcrumb
                      levels={t.expectedLevels}
                      compareWith={t.predictedLevels}
                    />
                  </td>
                  <td className="p-2">
                    <PathBreadcrumb
                      levels={t.predictedLevels}
                      compareWith={t.expectedLevels}
                    />
                  </td>
                  <td className="p-2">
                    <CorrectnessIndicator score={t.correctnessScore} />
                  </td>
                  <td className="p-2">
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        getConfidenceColor(t.supplierProfile?.confidence ?? 'unknown'),
                      )}
                    >
                      {t.supplierProfile?.confidence ?? 'n/a'}
                    </span>
                  </td>
                </tr>
                {/* Expanded row */}
                {expandedId === t.id && (
                  <tr key={`${t.id}-detail`}>
                    <td colSpan={9} className="bg-gray-50 p-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-2">
                            AI Reasoning
                          </h4>
                          <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                            {t.reasoning || 'No reasoning available.'}
                          </p>
                          {t.error && (
                            <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                              Error: {t.error}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 mb-2">
                            Supplier Profile
                          </h4>
                          {t.supplierProfile ? (
                            <dl className="text-xs space-y-1">
                              <dt className="text-gray-500">Name</dt>
                              <dd className="text-gray-800">{t.supplierProfile.supplierName}</dd>
                              <dt className="text-gray-500 mt-1">Industry</dt>
                              <dd className="text-gray-800">{t.supplierProfile.industry || 'Unknown'}</dd>
                              <dt className="text-gray-500 mt-1">Products/Services</dt>
                              <dd className="text-gray-800">
                                {t.supplierProfile.productsServices || 'Unknown'}
                              </dd>
                              <dt className="text-gray-500 mt-1">Confidence</dt>
                              <dd className="text-gray-800">{t.supplierProfile.confidence}</dd>
                              <dt className="text-gray-500 mt-1">Service Type</dt>
                              <dd className="text-gray-800">{t.supplierProfile.serviceType || 'N/A'}</dd>
                            </dl>
                          ) : (
                            <p className="text-xs text-gray-400 italic">No supplier profile</p>
                          )}
                          <h4 className="text-xs font-semibold text-gray-700 mb-2 mt-4">
                            Transaction Details
                          </h4>
                          <dl className="text-xs space-y-1">
                            <dt className="text-gray-500">Amount</dt>
                            <dd className="text-gray-800">{formatAmount(t.amount)}</dd>
                            <dt className="text-gray-500 mt-1">GL Description</dt>
                            <dd className="text-gray-800">{t.glDescription || 'N/A'}</dd>
                            <dt className="text-gray-500 mt-1">Company</dt>
                            <dd className="text-gray-800">{t.company || t.department || 'N/A'}</dd>
                            <dt className="text-gray-500 mt-1">Cost Center</dt>
                            <dd className="text-gray-800">{t.costCenter || 'N/A'}</dd>
                            {t.memo && (
                              <>
                                <dt className="text-gray-500 mt-1">Memo</dt>
                                <dd className="text-gray-800">{t.memo}</dd>
                              </>
                            )}
                            {t.classificationStatus && (
                              <>
                                <dt className="text-gray-500 mt-1">Classification Status</dt>
                                <dd className="text-gray-800">{t.classificationStatus}</dd>
                              </>
                            )}
                          </dl>
                        </div>
                      </div>
                      <button
                        className="mt-3 text-xs text-blue-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailTransaction(t);
                        }}
                      >
                        View full details →
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page + 1} of {pageCount}
          </span>
          <button
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Full Detail Modal */}
      {detailTransaction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-8">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Transaction Detail</h3>
              <button
                onClick={() => setDetailTransaction(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Classification</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-gray-500">Expected:</span>
                    <PathBreadcrumb
                      levels={detailTransaction.expectedLevels}
                      compareWith={detailTransaction.predictedLevels}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Predicted:</span>
                    <PathBreadcrumb
                      levels={detailTransaction.predictedLevels}
                      compareWith={detailTransaction.expectedLevels}
                      className="mt-1"
                    />
                  </div>
                  <CorrectnessIndicator score={detailTransaction.correctnessScore} />
                </div>

                <h4 className="text-sm font-semibold text-gray-700 mt-6 mb-2">AI Reasoning</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 p-3 rounded">
                  {detailTransaction.reasoning || 'No reasoning available.'}
                </p>
                {detailTransaction.error && (
                  <div className="mt-2 p-3 bg-red-50 rounded text-sm text-red-700">
                    Error: {detailTransaction.error}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Transaction Data</h4>
                <dl className="text-sm space-y-2 bg-gray-50 p-3 rounded">
                  {[
                    ['Company', detailTransaction.company || detailTransaction.department],
                    ['Row', String(detailTransaction.rowIndex)],
                    ['Supplier', detailTransaction.supplierName],
                    ['Line Description', detailTransaction.lineDescription],
                    ['Amount', formatAmount(detailTransaction.amount)],
                    ['GL Description', detailTransaction.glDescription],
                    ['Cost Center', detailTransaction.costCenter],
                    ['Memo', detailTransaction.memo],
                    ['Invoice Date', detailTransaction.invoiceDate],
                    ['Status', detailTransaction.classificationStatus],
                    ['Source', `${detailTransaction.testSet}/${detailTransaction.runId}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex">
                      <dt className="w-32 text-gray-500 shrink-0">{label}</dt>
                      <dd className="text-gray-800">{value || 'N/A'}</dd>
                    </div>
                  ))}
                </dl>

                {detailTransaction.supplierProfile && (
                  <>
                    <h4 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
                      Supplier Profile
                    </h4>
                    <dl className="text-sm space-y-2 bg-gray-50 p-3 rounded">
                      {[
                        ['Name', detailTransaction.supplierProfile.supplierName],
                        ['Official Name', detailTransaction.supplierProfile.officialBusinessName],
                        ['Industry', detailTransaction.supplierProfile.industry],
                        ['Products', detailTransaction.supplierProfile.productsServices],
                        ['Service Type', detailTransaction.supplierProfile.serviceType],
                        ['Confidence', detailTransaction.supplierProfile.confidence],
                        ['Large Company', detailTransaction.supplierProfile.isLargeCompany ? 'Yes' : 'No'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex">
                          <dt className="w-32 text-gray-500 shrink-0">{label}</dt>
                          <dd className="text-gray-800">{value || 'N/A'}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
