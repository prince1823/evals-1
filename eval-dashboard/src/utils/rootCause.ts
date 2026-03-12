import type { Transaction } from '@/types/data';

export interface ConfusionPair {
  expected: string;
  predicted: string;
  count: number;
}

export interface SupplierBreakdownEntry {
  supplier: string;
  count: number;
}

export interface RootCause {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  errorLevel: 'L1' | 'L2' | 'L3';
  count: number;
  percentage: number;
  transactions: Transaction[];
  affectedSuppliers: string[];
  exampleExpected: string;
  examplePredicted: string;
  suggestedFix: string;
  topConfusionPairs: ConfusionPair[];
  supplierBreakdown: SupplierBreakdownEntry[];
}

/**
 * Categorize misclassified transactions into root cause groups.
 *
 * Groups by the SPECIFIC confusion pattern at the failing level, so instead of
 * one generic "Domain Misclassification" bucket for all L1 errors, you get
 * separate root causes like "clinical → non clinical" and "it → facilities".
 */
export function categorizeRootCauses(allTransactions: Transaction[]): RootCause[] {
  // Exclude classification_error rows — they aren't misclassifications, they're processing failures
  const classified = allTransactions.filter(
    (t) => t.classificationStatus !== 'classification_error',
  );
  const misclassified = classified.filter((t) => !t.isExactMatch);
  if (misclassified.length === 0) return [];

  // Group by specific error pattern at the failing level
  const patternGroups = new Map<string, Transaction[]>();

  for (const t of misclassified) {
    const score = t.correctnessScore;
    let patternKey: string;

    if (score === 0) {
      // L1 wrong: group by expected_L1 → predicted_L1
      const expL1 = (t.expectedLevels[0] ?? '').toLowerCase();
      const predL1 = (t.predictedLevels[0] ?? '').toLowerCase();
      patternKey = `L1:${expL1}→${predL1}`;
    } else if (score === 1) {
      // L2 wrong: group by expected_L2 → predicted_L2
      const expL2 = (t.expectedLevels[1] ?? '').toLowerCase();
      const predL2 = (t.predictedLevels[1] ?? '').toLowerCase();
      patternKey = `L2:${expL2}→${predL2}`;
    } else {
      // L3 wrong: group by expected_L3 → predicted_L3
      const expL3 = (t.expectedLevels[2] ?? '').toLowerCase();
      const predL3 = (t.predictedLevels[2] ?? '').toLowerCase();
      patternKey = `L3:${expL3}→${predL3}`;
    }

    const list = patternGroups.get(patternKey) ?? [];
    list.push(t);
    patternGroups.set(patternKey, list);
  }

  // Build root causes from each pattern group
  const results: RootCause[] = [];

  for (const [patternKey, txns] of patternGroups) {
    const [levelStr, patternStr] = patternKey.split(':');
    const [expectedVal, predictedVal] = (patternStr ?? '').split('→');
    const score = levelStr === 'L1' ? 0 : levelStr === 'L2' ? 1 : 2;
    const errorLevel = levelStr as 'L1' | 'L2' | 'L3';

    // Build supplier breakdown
    const supplierCounts = new Map<string, number>();
    for (const t of txns) {
      const s = t.supplierName;
      supplierCounts.set(s, (supplierCounts.get(s) ?? 0) + 1);
    }
    const supplierBreakdown = Array.from(supplierCounts.entries())
      .map(([supplier, count]) => ({ supplier, count }))
      .sort((a, b) => b.count - a.count);

    // Build top confusion pairs (full path level)
    const pairCounts = new Map<string, number>();
    for (const t of txns) {
      const key = `${t.expectedPath}|||${t.predictedPath}`;
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }
    const topConfusionPairs = Array.from(pairCounts.entries())
      .map(([key, count]) => {
        const [expected, predicted] = key.split('|||');
        return { expected, predicted, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const affectedSuppliers = supplierBreakdown.map((s) => s.supplier);
    const sample = txns[0];
    const category = detectCategory(score, expectedVal, predictedVal, txns, supplierBreakdown);

    results.push({
      id: patternKey,
      name: category.name,
      description: category.description,
      severity: category.severity,
      errorLevel,
      count: txns.length,
      percentage: (txns.length / misclassified.length) * 100,
      transactions: txns,
      affectedSuppliers,
      exampleExpected: sample.expectedPath,
      examplePredicted: sample.predictedPath,
      suggestedFix: category.suggestedFix,
      topConfusionPairs,
      supplierBreakdown,
    });
  }

  results.sort((a, b) => b.count - a.count);
  return results;
}

function detectCategory(
  score: number,
  expectedVal: string,
  predictedVal: string,
  txns: Transaction[],
  supplierBreakdown: SupplierBreakdownEntry[],
): {
  name: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  suggestedFix: string;
} {
  const topSupplier = supplierBreakdown[0]?.supplier ?? 'unknown';
  const topSupplierCount = supplierBreakdown[0]?.count ?? 0;
  const topSupplierPct = txns.length > 0 ? ((topSupplierCount / txns.length) * 100).toFixed(0) : '0';
  const supplierCount = supplierBreakdown.length;

  if (score === 0) {
    return {
      name: `L1: "${expectedVal}" classified as "${predictedVal}"`,
      description:
        `${txns.length} transactions expected in the "${expectedVal}" domain were classified as "${predictedVal}". ` +
        `This affects ${supplierCount} supplier${supplierCount > 1 ? 's' : ''}, ` +
        `with "${topSupplier}" accounting for ${topSupplierPct}% of these errors (${topSupplierCount} transactions). ` +
        `This is a critical error — the AI fundamentally misidentifies the business context.`,
      severity: 'critical',
      suggestedFix:
        `Add supplier-specific L1 mapping rules. ` +
        (supplierCount <= 3
          ? `Create explicit profiles for ${supplierBreakdown.map((s) => `"${s.supplier}"`).join(', ')} that map to the "${expectedVal}" domain.`
          : `Prioritize "${topSupplier}" (${topSupplierCount} errors), then address the remaining ${supplierCount - 1} suppliers. `) +
        ` Review the taxonomy boundary between "${expectedVal}" and "${predictedVal}" for ambiguous transactions.`,
    };
  }

  if (score === 1) {
    const sample = txns[0];
    const l1 = sample.expectedLevels[0] ?? '';
    return {
      name: `L2: "${expectedVal}" → "${predictedVal}"`,
      description:
        `${txns.length} transactions within the "${l1}" domain have the wrong L2 category: ` +
        `expected "${expectedVal}" but classified as "${predictedVal}". ` +
        `This affects ${supplierCount} supplier${supplierCount > 1 ? 's' : ''}, ` +
        `with "${topSupplier}" accounting for ${topSupplierPct}% (${topSupplierCount} transactions). ` +
        `The AI correctly identifies the domain but confuses related categories within it.`,
      severity: 'major',
      suggestedFix:
        `Add disambiguation rules within the "${l1}" domain to distinguish "${expectedVal}" from "${predictedVal}". ` +
        `For "${topSupplier}", create a supplier profile that explicitly maps to "${expectedVal}". ` +
        `Review whether the line descriptions or GL codes can help differentiate these categories.`,
    };
  }

  // Score 2: L3 wrong
  const sample = txns[0];
  const l1 = sample.expectedLevels[0] ?? '';
  const l2 = sample.expectedLevels[1] ?? '';

  // Detect if predicted is a generic catch-all
  const genericTerms = ['other', 'general', 'miscellaneous', 'misc', 'unclassified'];
  const predictedIsGeneric = genericTerms.some((t) => predictedVal.includes(t));

  if (predictedIsGeneric) {
    return {
      name: `L3: "${expectedVal}" defaulting to "${predictedVal}"`,
      description:
        `${txns.length} transactions under "${l1} > ${l2}" are classified into the generic catch-all ` +
        `"${predictedVal}" instead of the specific subcategory "${expectedVal}". ` +
        `This affects ${supplierCount} supplier${supplierCount > 1 ? 's' : ''}, ` +
        `with "${topSupplier}" accounting for ${topSupplierPct}% (${topSupplierCount} transactions). ` +
        `The AI lacks confidence to select the precise L3 subcategory and falls back to a generic label.`,
      severity: 'minor',
      suggestedFix:
        `Add explicit L3 mapping rules for the "${l2}" category. ` +
        `For "${topSupplier}", create a supplier profile that specifies "${expectedVal}" as the L3 category. ` +
        `Consider adding keyword rules based on line descriptions to disambiguate "${expectedVal}" from the generic "${predictedVal}".`,
    };
  }

  return {
    name: `L3: "${expectedVal}" → "${predictedVal}"`,
    description:
      `${txns.length} transactions under "${l1} > ${l2}" are classified as ` +
      `"${predictedVal}" instead of "${expectedVal}". ` +
      `This affects ${supplierCount} supplier${supplierCount > 1 ? 's' : ''}, ` +
      `with "${topSupplier}" accounting for ${topSupplierPct}% (${topSupplierCount} transactions). ` +
      `These subcategories are semantically similar, and the AI picks the wrong one.`,
    severity: 'minor',
    suggestedFix:
      `Clarify the taxonomy distinction between "${expectedVal}" and "${predictedVal}" within "${l2}". ` +
      `For "${topSupplier}", add a supplier-specific rule mapping to "${expectedVal}". ` +
      `Review line descriptions to find distinguishing keywords that could drive correct L3 selection.`,
  };
}

/**
 * Get the most common value in an array.
 */
function mode(arr: number[]): number {
  const counts = new Map<number, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let maxCount = 0;
  let maxVal = arr[0];
  for (const [val, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxVal = val;
    }
  }
  return maxVal;
}

/**
 * Compute supplier error concentration data for charts.
 */
export function getSupplierErrorConcentration(
  transactions: Transaction[],
): { supplier: string; count: number; scores: Record<number, number> }[] {
  const classified = transactions.filter(
    (t) => t.classificationStatus !== 'classification_error',
  );
  const misclassified = classified.filter((t) => !t.isExactMatch);
  const groups = new Map<string, Transaction[]>();
  for (const t of misclassified) {
    const list = groups.get(t.supplierName) ?? [];
    list.push(t);
    groups.set(t.supplierName, list);
  }

  return Array.from(groups.entries())
    .map(([supplier, txns]) => {
      const scores: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
      for (const t of txns) scores[t.correctnessScore] = (scores[t.correctnessScore] || 0) + 1;
      return { supplier, count: txns.length, scores };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Check how many misclassified transactions lack supplier profiles.
 */
export function getMissingProfileStats(transactions: Transaction[]): {
  misclassifiedTotal: number;
  missingProfileCount: number;
  uniqueSuppliersWithoutProfile: string[];
} {
  const classified = transactions.filter(
    (t) => t.classificationStatus !== 'classification_error',
  );
  const misclassified = classified.filter((t) => !t.isExactMatch);
  const noProfile = misclassified.filter((t) => !t.supplierProfile);
  const suppliers = new Set(noProfile.map((t) => t.supplierName));
  return {
    misclassifiedTotal: misclassified.length,
    missingProfileCount: noProfile.length,
    uniqueSuppliersWithoutProfile: Array.from(suppliers).sort(),
  };
}
