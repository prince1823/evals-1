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

// ── Expected file types ──

interface ExpectedRow {
  path: string;
  rawRow: Record<string, string> | null;
}

interface ExpectedFileResult {
  rows: ExpectedRow[];
  isCSV: boolean;
}

// ── Key-based row matching ──

/** Maps pipeline column aliases → expected column aliases for composite key matching. */
const KEY_COLUMN_MAP: { pipeline: string[]; expected: string[] }[] = [
  { pipeline: ['supplier_name', 'canonical_supplier_name', 'supplier'], expected: ['Supplier'] },
  { pipeline: ['line_description', 'description', 'line_desc'], expected: ['Line Item Description'] },
  { pipeline: ['spend_amount', 'amount'], expected: ['Amount USD', 'Ledger Debit Amount'] },
  { pipeline: ['invoice_date'], expected: ['Accounting Date'] },
  { pipeline: ['company'], expected: ['Company'] },
  { pipeline: ['gl_description', 'gl_desc'], expected: ['GL Account Name'] },
  { pipeline: ['cost_center', 'cost_center_code'], expected: ['Cost Center Name'] },
  { pipeline: ['memo'], expected: ['Memo'] },
];

function normalizeKeyValue(val: string): string {
  let s = val.trim().toLowerCase().replace(/\s+/g, ' ');
  // Normalize numeric-looking values (strip $ and , then round)
  const cleaned = s.replace(/[,$]/g, '');
  const num = parseFloat(cleaned);
  if (!isNaN(num) && /^[,$\d.\s-]+$/.test(val.trim())) {
    s = num.toFixed(2);
  }
  return s;
}

/**
 * Detect which key columns exist in both a pipeline row and an expected row.
 * Returns the resolved alias pairs, or null if fewer than 2 columns match.
 */
function detectMatchableColumns(
  pipelineRow: Record<string, string>,
  expectedRow: Record<string, string>,
): { pipeline: string[]; expected: string[] }[] | null {
  const matched: { pipeline: string[]; expected: string[] }[] = [];
  for (const entry of KEY_COLUMN_MAP) {
    const pVal = getStr(pipelineRow, ...entry.pipeline);
    const eVal = getStr(expectedRow, ...entry.expected);
    if (pVal && eVal) {
      matched.push(entry);
    }
  }
  return matched.length >= 2 ? matched : null;
}

function buildRowKey(row: Record<string, string>, keyFields: string[][]): string {
  return keyFields.map((aliases) => normalizeKeyValue(getStr(row, ...aliases))).join('|||');
}

interface MatchedPair {
  classifiedRow: Record<string, string>;
  expectedPath: string;
}

/**
 * Match pipeline rows to expected rows using a composite key built from shared columns.
 * Falls back to index-based matching if key matching isn't possible.
 */
function matchRows(
  classifiedRows: Record<string, string>[],
  expectedResult: ExpectedFileResult,
): MatchedPair[] {
  // If not CSV or no raw rows, fall back to index matching
  if (!expectedResult.isCSV || !expectedResult.rows[0]?.rawRow) {
    return indexMatch(classifiedRows, expectedResult);
  }

  const columns = detectMatchableColumns(classifiedRows[0], expectedResult.rows[0].rawRow!);
  if (!columns) {
    return indexMatch(classifiedRows, expectedResult);
  }

  const pipelineKeys = columns.map((c) => c.pipeline);
  const expectedKeys = columns.map((c) => c.expected);

  // Build a map from composite key → list of expected rows (handles duplicates)
  const expectedMap = new Map<string, ExpectedRow[]>();
  for (const eRow of expectedResult.rows) {
    if (!eRow.rawRow) continue;
    const key = buildRowKey(eRow.rawRow, expectedKeys);
    const list = expectedMap.get(key) ?? [];
    list.push(eRow);
    expectedMap.set(key, list);
  }

  const pairs: MatchedPair[] = [];
  let matchedCount = 0;

  for (const row of classifiedRows) {
    const key = buildRowKey(row, pipelineKeys);
    const candidates = expectedMap.get(key);
    if (candidates && candidates.length > 0) {
      const match = candidates.shift()!; // consume first match (FIFO)
      if (candidates.length === 0) expectedMap.delete(key);
      pairs.push({ classifiedRow: row, expectedPath: match.path });
      matchedCount++;
    } else {
      // No match found — leave expected path empty
      pairs.push({ classifiedRow: row, expectedPath: '' });
    }
  }

  const unmatchedCount = classifiedRows.length - matchedCount;
  if (unmatchedCount > 0) {
    console.warn(
      `Key-based matching: ${matchedCount}/${classifiedRows.length} rows matched, ${unmatchedCount} unmatched.`,
    );
  }

  return pairs;
}

function indexMatch(
  classifiedRows: Record<string, string>[],
  expectedResult: ExpectedFileResult,
): MatchedPair[] {
  const count = Math.min(classifiedRows.length, expectedResult.rows.length);
  if (classifiedRows.length !== expectedResult.rows.length) {
    console.warn(
      `Row count mismatch: classified has ${classifiedRows.length} rows, expected has ${expectedResult.rows.length} lines. Using first ${count}.`,
    );
  }
  return classifiedRows.slice(0, count).map((row, i) => ({
    classifiedRow: row,
    expectedPath: expectedResult.rows[i]?.path ?? '',
  }));
}

// ── File parsing ──

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
 * Parse an expected file.
 * Supports two formats:
 *   1. Plain text — one classification path per line (level1|level2|level3)
 *   2. CSV — with Level 1 / Level 2 / Level 3 columns (picks the deepest level column that
 *      already contains the full pipe-delimited path, or joins them with |)
 */
async function parseExpectedFile(file: File): Promise<ExpectedFileResult> {
  const text = await readFileText(file);
  const firstLine = text.split('\n')[0] ?? '';

  // Heuristic: if the first line looks like a CSV header with "Level" columns, parse as CSV
  const hasLevelHeaders = /level\s*[123]/i.test(firstLine) && firstLine.includes(',');

  if (hasLevelHeaders) {
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (h) => h.trim(),
    });

    return {
      isCSV: true,
      rows: result.data.map((row) => {
        const l1 = getStr(row, 'Level 1', 'level_1', 'L1');
        const l2 = getStr(row, 'Level 2', 'level_2', 'L2');
        const l3 = getStr(row, 'Level 3', 'level_3', 'L3');

        let path: string;
        if (l3 && l3.includes('|')) path = l3;
        else if (l2 && l2.includes('|')) path = l2;
        else path = [l1, l2, l3].filter(Boolean).join('|');

        return { path, rawRow: row };
      }),
    };
  }

  // Plain text: one path per line
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    isCSV: false,
    rows: lines.map((path) => ({ path, rawRow: null })),
  };
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
  const [classifiedRows, expectedResult] = await Promise.all([
    parseClassifiedFile(classifiedFile),
    parseExpectedFile(expectedFile),
  ]);

  if (expectedResult.rows.length === 0) {
    throw new Error('Expected file is empty');
  }
  if (classifiedRows.length === 0) {
    throw new Error('Classified file is empty');
  }

  const matchedPairs = matchRows(classifiedRows, expectedResult);
  const predColumn = detectPredictionColumn(classifiedRows[0]);
  const safeName = datasetName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const transactions: Transaction[] = [];
  const companyGroups = new Map<string, Transaction[]>();

  for (let i = 0; i < matchedPairs.length; i++) {
    const { classifiedRow: row, expectedPath } = matchedPairs[i];
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
  const [classifiedRows, expectedResult] = await Promise.all([
    parseClassifiedFile(classifiedFile),
    parseExpectedFile(expectedFile),
  ]);

  const matchedPairs = matchRows(classifiedRows, expectedResult);
  const predCol = classifiedRows.length > 0 ? detectPredictionColumn(classifiedRows[0]) : '';

  const sampleRows = matchedPairs.slice(0, 3).map((pair) => ({
    expected: pair.expectedPath,
    predicted: getStr(pair.classifiedRow, predCol),
    supplier: getStr(pair.classifiedRow, 'canonical_supplier_name', 'supplier_name', 'supplier'),
  }));

  return {
    classifiedRowCount: classifiedRows.length,
    expectedLineCount: expectedResult.rows.length,
    classifiedColumns: classifiedRows.length > 0 ? Object.keys(classifiedRows[0]) : [],
    sampleRows,
  };
}
