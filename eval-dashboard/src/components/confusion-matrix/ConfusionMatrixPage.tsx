import { useState, useMemo } from 'react';
import { useEvalData } from '@/hooks/useEvalData';
import { buildConfusionMatrix } from '@/utils/stats';
import { LevelTabs } from '@/components/common/LevelTabs';
import { heatmapColor } from '@/utils/colors';
import { PathBreadcrumb } from '@/components/common/PathBreadcrumb';
import { X } from 'lucide-react';

export function ConfusionMatrixPage() {
  const { filteredTransactions } = useEvalData();
  const [level, setLevel] = useState(1);
  const [selectedCell, setSelectedCell] = useState<{
    expected: string;
    predicted: string;
    ids: string[];
  } | null>(null);

  const { matrix, categories, maxCount } = useMemo(() => {
    const cells = buildConfusionMatrix(filteredTransactions, level);
    const catSet = new Set<string>();
    for (const c of cells) {
      catSet.add(c.expected);
      catSet.add(c.predicted);
    }
    // Sort by frequency
    const catCounts = new Map<string, number>();
    for (const c of cells) {
      catCounts.set(c.expected, (catCounts.get(c.expected) ?? 0) + c.count);
    }
    const categories = Array.from(catSet).sort(
      (a, b) => (catCounts.get(b) ?? 0) - (catCounts.get(a) ?? 0),
    );
    // Limit to top 15 categories for readability
    const topCats = categories.slice(0, 15);
    const otherCats = new Set(categories.slice(15));

    // Rebuild matrix with "other" bucket
    const matrixMap = new Map<string, { count: number; ids: string[] }>();
    for (const c of cells) {
      const exp = otherCats.has(c.expected) ? '(other)' : c.expected;
      const pred = otherCats.has(c.predicted) ? '(other)' : c.predicted;
      const key = `${exp}|||${pred}`;
      const entry = matrixMap.get(key) ?? { count: 0, ids: [] };
      entry.count += c.count;
      entry.ids.push(...c.transactionIds);
      matrixMap.set(key, entry);
    }

    const finalCats = otherCats.size > 0 ? [...topCats, '(other)'] : topCats;
    let maxCount = 0;
    for (const entry of matrixMap.values()) {
      if (entry.count > maxCount) maxCount = entry.count;
    }

    return {
      matrix: matrixMap,
      categories: finalCats,
      maxCount,
    };
  }, [filteredTransactions, level]);

  const selectedTransactions = useMemo(() => {
    if (!selectedCell) return [];
    return filteredTransactions.filter((t) => selectedCell.ids.includes(t.id));
  }, [selectedCell, filteredTransactions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Confusion Matrix</h2>
        <LevelTabs activeLevel={level} onLevelChange={setLevel} />
      </div>
      <p className="text-sm text-gray-500">
        Click any cell to see the transactions. Green diagonal = correct, red = misclassified.
      </p>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 overflow-auto">
        <div className="min-w-[600px]">
          {/* Header row */}
          <div className="flex">
            <div className="w-40 shrink-0" />
            {categories.map((cat) => (
              <div
                key={cat}
                className="flex-1 min-w-[60px] text-center px-1"
              >
                <span
                  className="text-[10px] text-gray-500 font-medium writing-mode-vertical block transform -rotate-45 origin-bottom-left h-20 overflow-hidden"
                  title={cat}
                >
                  {cat.length > 20 ? cat.slice(0, 18) + '..' : cat}
                </span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {categories.map((expCat) => (
            <div key={expCat} className="flex items-center">
              <div
                className="w-40 shrink-0 text-[11px] text-gray-600 font-medium pr-2 text-right truncate"
                title={expCat}
              >
                {expCat}
              </div>
              {categories.map((predCat) => {
                const key = `${expCat}|||${predCat}`;
                const entry = matrix.get(key);
                const count = entry?.count ?? 0;
                const isCorrect = expCat === predCat;
                return (
                  <div
                    key={predCat}
                    className="flex-1 min-w-[60px] aspect-square flex items-center justify-center border border-gray-100 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all text-xs"
                    style={{
                      backgroundColor: count > 0 ? heatmapColor(count, maxCount, isCorrect) : 'transparent',
                    }}
                    onClick={() => {
                      if (count > 0 && entry) {
                        setSelectedCell({
                          expected: expCat,
                          predicted: predCat,
                          ids: entry.ids,
                        });
                      }
                    }}
                    title={`Expected: ${expCat}\nPredicted: ${predCat}\nCount: ${count}`}
                  >
                    {count > 0 && (
                      <span className={count > maxCount * 0.5 ? 'text-white font-bold' : 'text-gray-800 font-medium'}>
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="flex mt-2">
            <div className="w-40 shrink-0" />
            <p className="text-[10px] text-gray-400 text-center flex-1">Predicted →</p>
          </div>
          <p className="text-[10px] text-gray-400 text-right w-40 -mt-6">Expected ↓</p>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedCell && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              "{selectedCell.expected}" → "{selectedCell.predicted}" ({selectedTransactions.length}{' '}
              transactions)
            </h3>
            <button
              onClick={() => setSelectedCell(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-2">Supplier</th>
                  <th className="text-left p-2">Line Description</th>
                  <th className="text-left p-2">Expected</th>
                  <th className="text-left p-2">Predicted</th>
                  <th className="text-left p-2">Cube</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedTransactions.slice(0, 50).map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="p-2 max-w-[150px] truncate">{t.supplierName}</td>
                    <td className="p-2 max-w-[200px] truncate">{t.lineDescription}</td>
                    <td className="p-2">
                      <PathBreadcrumb levels={t.expectedLevels} compareWith={t.predictedLevels} />
                    </td>
                    <td className="p-2">
                      <PathBreadcrumb levels={t.predictedLevels} compareWith={t.expectedLevels} />
                    </td>
                    <td className="p-2">{t.cube}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedTransactions.length > 50 && (
              <p className="text-xs text-gray-400 text-center py-2">
                Showing 50 of {selectedTransactions.length} transactions
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
