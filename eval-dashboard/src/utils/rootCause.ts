import type { Transaction } from '@/types/data';

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
  exampleReasoning: string;
  suggestedFix: string;
}

interface SupplierErrorGroup {
  supplier: string;
  transactions: Transaction[];
  dominantScore: number;
  expectedL3Set: Set<string>;
  predictedL3Set: Set<string>;
  expectedL2Set: Set<string>;
  predictedL2Set: Set<string>;
}

/**
 * Categorize misclassified transactions into root cause groups.
 * Groups by supplier + error pattern to detect systematic issues.
 */
export function categorizeRootCauses(allTransactions: Transaction[]): RootCause[] {
  const misclassified = allTransactions.filter((t) => !t.isExactMatch);
  if (misclassified.length === 0) return [];

  // Group by supplier
  const supplierGroups = new Map<string, Transaction[]>();
  for (const t of misclassified) {
    const key = t.supplierName.toLowerCase().trim();
    const list = supplierGroups.get(key) ?? [];
    list.push(t);
    supplierGroups.set(key, list);
  }

  // Analyze each supplier group
  const groups: SupplierErrorGroup[] = [];
  for (const [supplier, txns] of supplierGroups) {
    const scores = txns.map((t) => t.correctnessScore);
    const dominantScore = mode(scores);
    groups.push({
      supplier,
      transactions: txns,
      dominantScore,
      expectedL3Set: new Set(txns.map((t) => (t.expectedLevels[2] ?? '').toLowerCase())),
      predictedL3Set: new Set(txns.map((t) => (t.predictedLevels[2] ?? '').toLowerCase())),
      expectedL2Set: new Set(txns.map((t) => (t.expectedLevels[1] ?? '').toLowerCase())),
      predictedL2Set: new Set(txns.map((t) => (t.predictedLevels[1] ?? '').toLowerCase())),
    });
  }

  // Categorize each group into a root cause
  const rootCauseMap = new Map<string, RootCause>();

  for (const group of groups) {
    const category = detectCategory(group);
    const existing = rootCauseMap.get(category.id);

    if (existing) {
      existing.count += group.transactions.length;
      existing.transactions.push(...group.transactions);
      if (!existing.affectedSuppliers.includes(group.transactions[0].supplierName)) {
        existing.affectedSuppliers.push(group.transactions[0].supplierName);
      }
    } else {
      const sample = group.transactions[0];
      rootCauseMap.set(category.id, {
        id: category.id,
        name: category.name,
        description: category.description,
        severity: category.severity,
        errorLevel: category.errorLevel,
        count: group.transactions.length,
        percentage: 0,
        transactions: [...group.transactions],
        affectedSuppliers: [sample.supplierName],
        exampleExpected: sample.expectedPath,
        examplePredicted: sample.predictedPath,
        exampleReasoning: sample.reasoning,
        suggestedFix: category.suggestedFix,
      });
    }
  }

  // Calculate percentages and sort by count desc
  const results = Array.from(rootCauseMap.values());
  for (const rc of results) {
    rc.percentage = (rc.count / misclassified.length) * 100;
  }
  results.sort((a, b) => b.count - a.count);

  return results;
}

function detectCategory(group: SupplierErrorGroup): {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  errorLevel: 'L1' | 'L2' | 'L3';
  suggestedFix: string;
} {
  const sample = group.transactions[0];
  const score = group.dominantScore;

  // Score 0: L1 is wrong — domain misclassification
  if (score === 0) {
    const expL1 = sample.expectedLevels[0] ?? '';
    const predL1 = sample.predictedLevels[0] ?? '';
    return {
      id: 'domain-misclassification',
      name: 'Domain Misclassification',
      description: `The AI classifies transactions into the wrong top-level domain (L1). Expected "${expL1}" but predicted "${predL1}". This is the most severe error type — the AI fundamentally misunderstands the transaction's business context.`,
      severity: 'critical',
      errorLevel: 'L1',
      suggestedFix: `Improve L1 classification by adding supplier-specific rules. For suppliers like "${sample.supplierName}", ensure the supplier profile correctly maps to the "${expL1}" domain. Consider adding keyword disambiguation rules (e.g., "lab fees" in HR context ≠ clinical laboratory).`,
    };
  }

  // Score 1: L1 correct, L2 wrong — category boundary confusion
  if (score === 1) {
    const expL2 = sample.expectedLevels[1] ?? '';
    const predL2 = sample.predictedLevels[1] ?? '';
    return {
      id: 'category-boundary-confusion',
      name: 'Category Boundary Confusion',
      description: `The AI gets the right domain (L1) but picks the wrong category (L2). Expected "${expL2}" but predicted "${predL2}". The categories are related but the AI fails to distinguish between them.`,
      severity: 'major',
      errorLevel: 'L2',
      suggestedFix: `Add taxonomy disambiguation rules for the "${sample.expectedLevels[0]}" domain to distinguish "${expL2}" from "${predL2}". Create supplier profiles for "${sample.supplierName}" that explicitly map to the "${expL2}" category.`,
    };
  }

  // Score 2: L1+L2 correct, L3 wrong
  const expL3 = sample.expectedLevels[2] ?? '';
  const predL3 = sample.predictedLevels[2] ?? '';

  // Check if predicted L3 is a generic/catch-all ("other", "general", etc.)
  const genericTerms = ['other', 'general', 'miscellaneous', 'misc', 'unclassified'];
  const predictedIsGeneric = genericTerms.some((term) => predL3.toLowerCase().includes(term));

  if (predictedIsGeneric) {
    return {
      id: 'taxonomy-specificity-gap',
      name: 'Taxonomy Specificity Gap',
      description: `The AI correctly identifies L1 and L2 but defaults to a generic L3 category ("${predL3}") instead of the specific one ("${expL3}"). The model lacks confidence to pick the precise subcategory.`,
      severity: 'minor',
      errorLevel: 'L3',
      suggestedFix: `Add explicit L3 mapping rules for "${sample.expectedLevels[1]}" subcategories. For suppliers like "${sample.supplierName}", create profiles that specify the exact L3 category "${expL3}" instead of falling back to "${predL3}".`,
    };
  }

  // Check if the expected L3 is a service/fee type but predicted is a product/deliverable
  const serviceTerms = ['fees', 'services', 'management', 'consulting', 'agency'];
  const deliverableTerms = ['supplies', 'print', 'equipment', 'materials', 'products'];
  const expIsService = serviceTerms.some((t) => expL3.toLowerCase().includes(t));
  const predIsDeliverable = deliverableTerms.some((t) => predL3.toLowerCase().includes(t));

  if (expIsService && predIsDeliverable) {
    return {
      id: 'service-vs-deliverable',
      name: 'Service vs Deliverable Confusion',
      description: `The AI confuses service-level categories ("${expL3}") with deliverable-level categories ("${predL3}"). It classifies based on what was delivered rather than the service type.`,
      severity: 'minor',
      errorLevel: 'L3',
      suggestedFix: `Add classification guidance to distinguish service categories from deliverable categories. For "${sample.expectedLevels[1]}", ensure the AI classifies by service type (e.g., "${expL3}") rather than the physical deliverable.`,
    };
  }

  // Default for score 2: subcategory confusion (related L3 categories)
  return {
    id: 'subcategory-confusion',
    name: 'Subcategory Confusion',
    description: `The AI correctly identifies L1 and L2 but picks a related but incorrect L3 subcategory. Expected "${expL3}" but predicted "${predL3}". These subcategories are semantically similar.`,
    severity: 'minor',
    errorLevel: 'L3',
    suggestedFix: `Clarify the distinction between "${expL3}" and "${predL3}" in the taxonomy. Add supplier-specific rules for "${sample.supplierName}" to map to the correct L3 category.`,
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
  const misclassified = transactions.filter((t) => !t.isExactMatch);
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
  const misclassified = transactions.filter((t) => !t.isExactMatch);
  const noProfile = misclassified.filter((t) => !t.supplierProfile);
  const suppliers = new Set(noProfile.map((t) => t.supplierName));
  return {
    misclassifiedTotal: misclassified.length,
    missingProfileCount: noProfile.length,
    uniqueSuppliersWithoutProfile: Array.from(suppliers).sort(),
  };
}
