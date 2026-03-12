import type {
  Transaction,
  LevelAccuracy,
  SupplierAccuracyEntry,
  ConfusionCell,
  MisclassificationPair,
} from '@/types/data';

export function computeLevelAccuracy(transactions: Transaction[]): LevelAccuracy {
  // Exclude classification_error rows — accuracy is only meaningful for classified rows
  const classified = transactions.filter(
    (t) => t.classificationStatus !== 'classification_error',
  );
  const total = classified.length;
  if (total === 0) {
    const zero = { correct: 0, total: 0, pct: 0 };
    return { l1: zero, l2: zero, l3: zero, exact: zero };
  }
  const l1 = classified.filter((t) => t.correctnessScore >= 1).length;
  const l2 = classified.filter((t) => t.correctnessScore >= 2).length;
  const l3 = classified.filter((t) => t.correctnessScore >= 3).length;
  const exact = classified.filter((t) => t.isExactMatch).length;
  return {
    l1: { correct: l1, total, pct: +((l1 / total) * 100).toFixed(1) },
    l2: { correct: l2, total, pct: +((l2 / total) * 100).toFixed(1) },
    l3: { correct: l3, total, pct: +((l3 / total) * 100).toFixed(1) },
    exact: { correct: exact, total, pct: +((exact / total) * 100).toFixed(1) },
  };
}

export function aggregateBySupplier(transactions: Transaction[]): SupplierAccuracyEntry[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = `${t.supplierName}|||${t.cube}`;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  return Array.from(groups.entries())
    .map(([key, txns]) => {
      const [supplierName, cube] = key.split('|||');
      const total = txns.length;
      // Compute accuracy only over classified (non-error) rows
      const classified = txns.filter((t) => t.classificationStatus !== 'classification_error');
      const classifiedTotal = classified.length;
      const confidence = txns[0]?.supplierProfile?.confidence ?? 'unknown';
      return {
        supplierName,
        cube,
        totalTransactions: total,
        classifiedTransactions: classifiedTotal,
        errorTransactions: total - classifiedTotal,
        exactMatchCount: classified.filter((t) => t.isExactMatch).length,
        l1Accuracy: classifiedTotal > 0 ? +(classified.filter((t) => t.correctnessScore >= 1).length / classifiedTotal * 100).toFixed(1) : 0,
        l2Accuracy: classifiedTotal > 0 ? +(classified.filter((t) => t.correctnessScore >= 2).length / classifiedTotal * 100).toFixed(1) : 0,
        l3Accuracy: classifiedTotal > 0 ? +(classified.filter((t) => t.correctnessScore >= 3).length / classifiedTotal * 100).toFixed(1) : 0,
        profileConfidence: confidence,
        isKnown: confidence !== 'low' && confidence !== 'unknown',
      };
    })
    .sort((a, b) => b.totalTransactions - a.totalTransactions);
}

export function buildConfusionMatrix(
  transactions: Transaction[],
  level: number,
): ConfusionCell[] {
  const counts = new Map<string, { count: number; ids: string[] }>();
  for (const t of transactions.filter((t) => t.classificationStatus !== 'classification_error')) {
    const expected = t.expectedLevels[level - 1]?.toLowerCase() ?? '(missing)';
    const predicted = t.predictedLevels[level - 1]?.toLowerCase() ?? '(missing)';
    const key = `${expected}|||${predicted}`;
    const entry = counts.get(key) ?? { count: 0, ids: [] };
    entry.count++;
    entry.ids.push(t.id);
    counts.set(key, entry);
  }
  return Array.from(counts.entries()).map(([key, val]) => {
    const [expected, predicted] = key.split('|||');
    return { expected, predicted, count: val.count, transactionIds: val.ids };
  });
}

export function findMisclassificationPairs(
  transactions: Transaction[],
  level: number,
): MisclassificationPair[] {
  const misclassified = transactions.filter((t) => {
    if (t.classificationStatus === 'classification_error') return false;
    const exp = t.expectedLevels[level - 1]?.toLowerCase();
    const pred = t.predictedLevels[level - 1]?.toLowerCase();
    return exp && pred && exp !== pred;
  });

  const pairCounts = new Map<
    string,
    { count: number; cubes: Record<string, number>; sampleIds: string[] }
  >();

  for (const t of misclassified) {
    const exp = t.expectedLevels[level - 1].toLowerCase();
    const pred = t.predictedLevels[level - 1].toLowerCase();
    const key = `${exp}|||${pred}`;
    const entry = pairCounts.get(key) ?? { count: 0, cubes: {}, sampleIds: [] };
    entry.count++;
    entry.cubes[t.cube] = (entry.cubes[t.cube] ?? 0) + 1;
    if (entry.sampleIds.length < 5) entry.sampleIds.push(t.id);
    pairCounts.set(key, entry);
  }

  return Array.from(pairCounts.entries())
    .map(([key, val]) => {
      const [expected, predicted] = key.split('|||');
      return {
        expected,
        predicted,
        count: val.count,
        cubes: val.cubes,
        sampleTransactionIds: val.sampleIds,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function computeInputFieldImpact(transactions: Transaction[]) {
  const fields: { key: keyof Transaction; label: string }[] = [
    { key: 'supplierName', label: 'Supplier Name' },
    { key: 'lineDescription', label: 'Line Description' },
    { key: 'glDescription', label: 'GL Description' },
    { key: 'department', label: 'Department' },
    { key: 'costCenter', label: 'Cost Center' },
  ];

  return fields
    .map(({ key, label }) => {
      const withValue = transactions.filter((t) => {
        const val = t[key];
        return val != null && val !== '' && val !== '[blank]';
      });
      const withoutValue = transactions.filter((t) => {
        const val = t[key];
        return val == null || val === '' || val === '[blank]';
      });

      const accWith =
        withValue.length > 0
          ? withValue.filter((t) => t.isExactMatch).length / withValue.length
          : 0;
      const accWithout =
        withoutValue.length > 0
          ? withoutValue.filter((t) => t.isExactMatch).length / withoutValue.length
          : 0;

      return {
        field: label,
        withValueCount: withValue.length,
        withoutValueCount: withoutValue.length,
        accuracyWithValue: +(accWith * 100).toFixed(1),
        accuracyWithoutValue: +(accWithout * 100).toFixed(1),
        impactDelta: +((accWith - accWithout) * 100).toFixed(1),
      };
    })
    .sort((a, b) => Math.abs(b.impactDelta) - Math.abs(a.impactDelta));
}
