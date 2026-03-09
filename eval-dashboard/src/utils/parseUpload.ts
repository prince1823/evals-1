import Papa from 'papaparse';
import type { TestSet, Transaction, CubeResult } from '@/types/data';
import { calculateCorrectness, splitPath } from '@/utils/classification';
import { computeLevelAccuracy } from '@/utils/stats';

/**
 * Read a File as text.
 */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

/**
 * Get a string value from a row, trying multiple possible column names.
 */
function getStr(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key].trim();
    // Try lowercase
    const lower = key.toLowerCase();
    for (const k of Object.keys(row)) {
      if (k.toLowerCase() === lower) return row[k].trim();
    }
  }
  return '';
}

function getNum(row: Record<string, string>, ...keys: string[]): number | null {
  const s = getStr(row, ...keys);
  if (!s) return null;
  const n = parseFloat(s.replace(/[,$]/g, ''));
  return isNaN(n) ? null : n;
}

/**
 * Parse a classified CSV/TXT file into rows.
 */
async function parseClassifiedFile(file: File): Promise<Record<string, string>[]> {
  const text = await readFileText(file);

  // Use PapaParse for CSV files, or try it anyway for TXT
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    const critical = result.errors.filter((e) => e.type === 'Quotes' || e.type === 'Delimiter');
    if (critical.length > 0 && result.data.length === 0) {
      throw new Error(`Failed to parse ${file.name}: ${critical[0].message}`);
    }
  }

  if (result.data.length === 0) {
    throw new Error(`No data rows found in ${file.name}`);
  }

  return result.data;
}

/**
 * Parse an expected file (one classification path per line).
 */
async function parseExpectedFile(file: File): Promise<string[]> {
  const text = await readFileText(file);
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Detect which column holds the classification/prediction path.
 */
function detectPredictionColumn(row: Record<string, string>): string {
  const candidates = [
    'classification_path',
    'pipeline_output',
    'prediction_path',
    'predicted_path',
    'predicted',
    'output',
  ];
  for (const c of candidates) {
    const val = getStr(row, c);
    if (val && val.includes('|')) return c;
  }
  // Fallback: look for any column containing pipe-delimited values
  for (const [key, val] of Object.entries(row)) {
    if (typeof val === 'string' && val.includes('|') && val.split('|').length >= 2) {
      return key;
    }
  }
  return 'classification_path';
}

export interface ParseResult {
  testSet: TestSet;
  rowCount: number;
  supplierCount: number;
  companyCount: number;
}

/**
 * Parse uploaded classified + expected files into a TestSet.
 */
export async function parseUploadedFiles(
  classifiedFile: File,
  expectedFile: File,
  datasetName: string,
): Promise<ParseResult> {
  const [classifiedRows, expectedLines] = await Promise.all([
    parseClassifiedFile(classifiedFile),
    parseExpectedFile(expectedFile),
  ]);

  if (expectedLines.length === 0) {
    throw new Error('Expected file is empty');
  }
  if (classifiedRows.length === 0) {
    throw new Error('Classified file is empty');
  }

  const rowCount = Math.min(classifiedRows.length, expectedLines.length);
  if (classifiedRows.length !== expectedLines.length) {
    console.warn(
      `Row count mismatch: classified has ${classifiedRows.length} rows, expected has ${expectedLines.length} lines. Using first ${rowCount}.`,
    );
  }

  const predColumn = detectPredictionColumn(classifiedRows[0]);
  const safeName = datasetName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const transactions: Transaction[] = [];
  const companyGroups = new Map<string, Transaction[]>();

  for (let i = 0; i < rowCount; i++) {
    const row = classifiedRows[i];
    const expectedPath = expectedLines[i] || '';
    const classificationPath = getStr(row, predColumn);
    const correctness = calculateCorrectness(expectedPath, classificationPath);
    const expectedLevels = splitPath(expectedPath);
    const predictedLevels = splitPath(classificationPath);
    const maxLevel = expectedLevels.length;
    const company = getStr(row, 'company');
    const cubeId = company ? company.split(' ')[0] : 'unknown';

    const txn: Transaction = {
      id: `${safeName}/uploaded/${cubeId}/${i + 1}`,
      rowIndex: i + 1,
      cube: cubeId,
      testSet: safeName,
      runId: 'uploaded',
      expectedPath,
      predictedPath: classificationPath,
      expectedLevels,
      predictedLevels,
      correctnessScore: correctness,
      isExactMatch: correctness >= maxLevel && maxLevel > 0,
      supplierName: getStr(row, 'canonical_supplier_name', 'supplier_name', 'supplier'),
      lineDescription: getStr(row, 'line_description', 'description', 'line_desc'),
      amount: getNum(row, 'spend_amount', 'amount'),
      department: company,
      costCenter: getStr(row, 'cost_center', 'cost_center_code'),
      glDescription: getStr(row, 'gl_description', 'gl_desc'),
      invoiceDate: getStr(row, 'invoice_date'),
      reasoning: getStr(row, 'classification_reasoning', 'reasoning'),
      error: '',
      supplierProfile: null,
      columnsUsed: {},
      classificationStatus: getStr(row, 'classification_status'),
      memo: getStr(row, 'memo'),
      company,
    };

    transactions.push(txn);

    const cubeList = companyGroups.get(cubeId) ?? [];
    cubeList.push(txn);
    companyGroups.set(cubeId, cubeList);
  }

  // Build cubes
  const cubes: CubeResult[] = [];
  const byCube: Record<string, ReturnType<typeof computeLevelAccuracy>> = {};
  for (const [cube, txns] of companyGroups) {
    cubes.push({ cube, transactions: txns });
    byCube[cube] = computeLevelAccuracy(txns);
  }

  const testSet: TestSet = {
    name: safeName,
    runs: [
      {
        id: 'uploaded',
        testSet: safeName,
        cubes,
        summary: {
          totalTransactions: transactions.length,
          overallAccuracy: computeLevelAccuracy(transactions),
          byCube,
        },
      },
    ],
  };

  return {
    testSet,
    rowCount: transactions.length,
    supplierCount: new Set(transactions.map((t) => t.supplierName)).size,
    companyCount: companyGroups.size,
  };
}

/**
 * Quick preview: read first few rows from both files to show user a summary.
 */
export async function previewFiles(
  classifiedFile: File,
  expectedFile: File,
): Promise<{
  classifiedRowCount: number;
  expectedLineCount: number;
  classifiedColumns: string[];
  sampleRows: { expected: string; predicted: string; supplier: string }[];
}> {
  const [classifiedRows, expectedLines] = await Promise.all([
    parseClassifiedFile(classifiedFile),
    parseExpectedFile(expectedFile),
  ]);

  const predCol = classifiedRows.length > 0 ? detectPredictionColumn(classifiedRows[0]) : '';
  const sampleRows = [];
  for (let i = 0; i < Math.min(3, classifiedRows.length, expectedLines.length); i++) {
    sampleRows.push({
      expected: expectedLines[i] || '',
      predicted: getStr(classifiedRows[i], predCol),
      supplier: getStr(classifiedRows[i], 'canonical_supplier_name', 'supplier_name', 'supplier'),
    });
  }

  return {
    classifiedRowCount: classifiedRows.length,
    expectedLineCount: expectedLines.length,
    classifiedColumns: classifiedRows.length > 0 ? Object.keys(classifiedRows[0]) : [],
    sampleRows,
  };
}
