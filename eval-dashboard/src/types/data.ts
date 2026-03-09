export interface ProcessedData {
  testSets: TestSet[];
  secondaryData: SecondaryTransaction[];
  metadata: {
    generatedAt: string;
    totalTransactions: number;
    totalRuns: number;
  };
}

export interface TestSet {
  name: string;
  runs: Run[];
}

export interface Run {
  id: string;
  testSet: string;
  cubes: CubeResult[];
  summary: RunSummary;
}

export interface RunSummary {
  totalTransactions: number;
  overallAccuracy: LevelAccuracy;
  byCube: Record<string, LevelAccuracy>;
}

export interface LevelAccuracy {
  l1: AccuracyMetric;
  l2: AccuracyMetric;
  l3: AccuracyMetric;
  exact: AccuracyMetric;
}

export interface AccuracyMetric {
  correct: number;
  total: number;
  pct: number;
}

export interface CubeResult {
  cube: string;
  transactions: Transaction[];
}

export interface Transaction {
  id: string;
  rowIndex: number;
  cube: string;
  testSet: string;
  runId: string;
  expectedPath: string;
  predictedPath: string;
  expectedLevels: string[];
  predictedLevels: string[];
  correctnessScore: number;
  isExactMatch: boolean;
  supplierName: string;
  lineDescription: string;
  amount: number | null;
  department: string;
  costCenter: string;
  glDescription: string;
  invoiceDate: string;
  reasoning: string;
  error: string;
  supplierProfile: SupplierProfile | null;
  columnsUsed: Record<string, string>;
  classificationStatus?: string;
  memo?: string;
  company?: string;
}

export interface SupplierProfile {
  supplierName: string;
  officialBusinessName: string;
  description: string;
  industry: string;
  productsServices: string;
  confidence: string;
  isPerson: boolean;
  isLargeCompany: boolean;
  serviceType: string;
  targetMarket: string;
}

export interface SecondaryTransaction {
  rowIndex: number;
  lineDescription: string;
  spendAmount: number;
  glDescription: string;
  invoiceDate: string;
  company: string;
  costCenter: string;
  memo: string;
  canonicalSupplierName: string;
  classificationPath: string;
  classificationL1: string;
  classificationL2: string;
  classificationL3: string;
  classificationStatus: string;
  classificationReasoning: string;
  expectedPath: string;
  expectedLevels: string[];
  predictedLevels: string[];
  correctnessScore: number;
  isExactMatch: boolean;
}

export interface ConfusionCell {
  expected: string;
  predicted: string;
  count: number;
  transactionIds: string[];
}

export interface MisclassificationPair {
  expected: string;
  predicted: string;
  count: number;
  cubes: Record<string, number>;
  sampleTransactionIds: string[];
}

export interface SupplierAccuracyEntry {
  supplierName: string;
  cube: string;
  totalTransactions: number;
  exactMatchCount: number;
  l1Accuracy: number;
  l2Accuracy: number;
  l3Accuracy: number;
  profileConfidence: string;
  isKnown: boolean;
}

export interface FilterState {
  testSet: string;
  runId: string;
  cube: string;
  supplier: string;
  correctnessScores: number[];
  searchQuery: string;
}
