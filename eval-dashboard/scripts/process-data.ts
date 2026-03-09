import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import Papa from 'papaparse';

// --- Types ---

interface Transaction {
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

interface SupplierProfile {
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

interface SecondaryTransaction {
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

// --- Helpers ---

function splitPath(p: string): string[] {
  if (!p) return [];
  return p.split('|').map(s => s.trim()).filter(Boolean);
}

function calculateCorrectness(expected: string, pipeline: string): number {
  if (!expected || !pipeline) return 0;
  const expectedLevels = expected.split('|').map(s => s.trim().toLowerCase()).filter(Boolean);
  const pipelineLevels = pipeline.split('|').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!expectedLevels.length || !pipelineLevels.length) return 0;
  for (let i = 0; i < expectedLevels.length; i++) {
    if (i >= pipelineLevels.length) return i;
    if (expectedLevels[i] !== pipelineLevels[i]) return i;
  }
  return expectedLevels.length;
}

function safeParseJSON(str: string): any {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function parseSupplierProfile(raw: any): SupplierProfile | null {
  if (!raw) return null;
  const obj = typeof raw === 'string' ? safeParseJSON(raw) : raw;
  if (!obj) return null;
  return {
    supplierName: obj.supplier_name || '',
    officialBusinessName: obj.official_business_name || '',
    description: obj.description || '',
    industry: obj.industry || '',
    productsServices: obj.products_services || '',
    confidence: obj.confidence || 'unknown',
    isPerson: !!obj.is_person,
    isLargeCompany: !!obj.is_large_company,
    serviceType: obj.service_type || '',
    targetMarket: obj.target_market || '',
  };
}

function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = Papa.parse(content, { header: true, skipEmptyLines: true });
  return result.data as any[];
}

// Use Python's csv module for CSVs with malformed quoting (e.g., unescaped quotes in fields)
function parseCSVWithPython(filePath: string): any[] {
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const pyScript = path.join(scriptDir, 'csv-to-json.py');
  const result = execSync(`python3 ${JSON.stringify(pyScript)} ${JSON.stringify(filePath)}`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });
  return JSON.parse(result);
}

function getStr(row: any, key: string): string {
  const val = row[key];
  if (val == null) return '';
  return String(val).trim();
}

function getNum(row: any, key: string): number | null {
  const val = row[key];
  if (val == null || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// --- Main Processing ---

function processOutputCSV(
  filePath: string,
  cube: string,
  testSet: string,
  runId: string,
): Transaction[] {
  const rows = parseCSV(filePath);
  const transactions: Transaction[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const expectedPath = getStr(row, 'expected_output');
    const predictedPath = getStr(row, 'pipeline_output');

    let correctness = getNum(row, 'classification_correctness');
    if (correctness == null) {
      correctness = calculateCorrectness(expectedPath, predictedPath);
    }

    const expectedLevels = splitPath(expectedPath);
    const predictedLevels = splitPath(predictedPath);
    const maxLevel = expectedLevels.length;
    const isExactMatch = correctness >= maxLevel && maxLevel > 0;

    // Parse columns_used to find actual column names
    const columnsUsedRaw = safeParseJSON(getStr(row, 'columns_used')) || {};

    // Try to extract fields using columns_used mapping, or fallback to known column names
    const supplierNameCol = columnsUsedRaw.supplier_name || 'Supplier Name old' || 'Supplier Name';
    const lineDescCol = columnsUsedRaw.line_description || 'Line Description';
    const amountCol = columnsUsedRaw.amount || 'Amount';
    const deptCol = columnsUsedRaw.department || 'Business Unit';
    const ccCol = columnsUsedRaw.cost_center || 'Cost Center';
    const glCol = columnsUsedRaw.gl_description || 'GL Description';
    const invDateCol = columnsUsedRaw.invoice_date || 'Invoice Date';

    const supplierName = getStr(row, supplierNameCol) || getStr(row, 'supplier_name') || getStr(row, 'Supplier Name old') || getStr(row, 'Supplier Name');
    const lineDescription = getStr(row, lineDescCol) || getStr(row, 'line_description') || getStr(row, 'Line Description');
    const amount = getNum(row, amountCol) ?? getNum(row, 'amount') ?? getNum(row, 'Amount');
    const department = getStr(row, deptCol) || getStr(row, 'department') || getStr(row, 'Business Unit');
    const costCenter = getStr(row, ccCol) || getStr(row, 'cost_center') || getStr(row, 'Cost Center');
    const glDescription = getStr(row, glCol) || getStr(row, 'gl_description') || getStr(row, 'GL Description');
    const invoiceDate = getStr(row, invDateCol) || getStr(row, 'invoice_date') || getStr(row, 'Invoice Date');

    const rowIndex = getNum(row, 'row_number') ?? (i + 1);

    transactions.push({
      id: `${testSet}/${runId}/${cube}/${rowIndex}`,
      rowIndex: rowIndex as number,
      cube,
      testSet,
      runId,
      expectedPath,
      predictedPath,
      expectedLevels,
      predictedLevels,
      correctnessScore: correctness as number,
      isExactMatch,
      supplierName,
      lineDescription,
      amount,
      department,
      costCenter,
      glDescription,
      invoiceDate,
      reasoning: getStr(row, 'reasoning'),
      error: getStr(row, 'error'),
      supplierProfile: parseSupplierProfile(getStr(row, 'supplier_profile')),
      columnsUsed: columnsUsedRaw,
    });
  }

  return transactions;
}

function processPredictionsCSV(
  filePath: string,
  cube: string,
  testSet: string,
  runId: string,
): Transaction[] {
  const rows = parseCSV(filePath);
  const transactions: Transaction[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const expectedPath = getStr(row, 'expected_full_path') || getStr(row, 'expected_primary_path');
    const predictedPath = getStr(row, 'prediction_path');
    const correctness = calculateCorrectness(expectedPath, predictedPath);
    const expectedLevels = splitPath(expectedPath);
    const predictedLevels = splitPath(predictedPath);
    const maxLevel = expectedLevels.length;
    const isExactMatch = correctness >= maxLevel && maxLevel > 0;

    // Parse transaction features
    const features = safeParseJSON(getStr(row, 'transaction_features_json')) || {};

    transactions.push({
      id: `${testSet}/${runId}/${cube}/${i + 1}`,
      rowIndex: getNum(row, 'row_index') ?? (i + 1),
      cube,
      testSet,
      runId,
      expectedPath,
      predictedPath,
      expectedLevels,
      predictedLevels,
      correctnessScore: correctness,
      isExactMatch,
      supplierName: getStr(row, 'supplier') || features.supplier_name || '',
      lineDescription: features.line_description || '',
      amount: features.amount ?? null,
      department: features.department || '',
      costCenter: features.cost_center || '',
      glDescription: features.gl_description || '',
      invoiceDate: features.invoice_date || '',
      reasoning: getStr(row, 'reasoning'),
      error: getStr(row, 'error_message'),
      supplierProfile: null,
      columnsUsed: {},
    });
  }

  return transactions;
}

function computeLevelAccuracy(transactions: Transaction[]) {
  const total = transactions.length;
  if (total === 0) {
    const z = { correct: 0, total: 0, pct: 0 };
    return { l1: z, l2: z, l3: z, exact: z };
  }
  const l1 = transactions.filter(t => t.correctnessScore >= 1).length;
  const l2 = transactions.filter(t => t.correctnessScore >= 2).length;
  const l3 = transactions.filter(t => t.correctnessScore >= 3).length;
  const exact = transactions.filter(t => t.isExactMatch).length;
  return {
    l1: { correct: l1, total, pct: +((l1 / total) * 100).toFixed(1) },
    l2: { correct: l2, total, pct: +((l2 / total) * 100).toFixed(1) },
    l3: { correct: l3, total, pct: +((l3 / total) * 100).toFixed(1) },
    exact: { correct: exact, total, pct: +((exact / total) * 100).toFixed(1) },
  };
}

function main() {
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const projectRoot = path.resolve(scriptDir, '..');
  const evalsRoot = path.resolve(projectRoot, '..');
  const resultsDir = path.resolve(evalsRoot, 'colab91-evals-main', 'results');
  const outputDir = path.resolve(projectRoot, 'public', 'data');

  console.log('=== Eval Dashboard Data Processing ===');
  console.log(`Results dir: ${resultsDir}`);
  console.log(`Output dir: ${outputDir}`);

  if (!fs.existsSync(resultsDir)) {
    console.error(`Results directory not found: ${resultsDir}`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const testSets: any[] = [];

  // Discover test sets
  const testSetDirs = fs.readdirSync(resultsDir).filter(d => {
    const fullPath = path.join(resultsDir, d);
    return fs.statSync(fullPath).isDirectory();
  });

  for (const testSetName of testSetDirs) {
    const testSetPath = path.join(resultsDir, testSetName);
    console.log(`\nProcessing test set: ${testSetName}`);

    // Discover runs
    const runDirs = fs.readdirSync(testSetPath).filter(d => {
      const fullPath = path.join(testSetPath, d);
      return fs.statSync(fullPath).isDirectory() && d !== 'analysis' && d !== '__pycache__';
    });

    const runs: any[] = [];

    for (const runDir of runDirs) {
      const runPath = path.join(testSetPath, runDir);

      // Skip non-run directories (like files)
      if (runDir.endsWith('.py') || runDir.endsWith('.txt')) continue;

      console.log(`  Run: ${runDir}`);

      // Discover cubes in run
      const cubeDirs = fs.readdirSync(runPath).filter(d => {
        const fullPath = path.join(runPath, d);
        return fs.statSync(fullPath).isDirectory() && d !== 'analysis';
      });

      const cubes: any[] = [];
      const allTransactions: Transaction[] = [];

      for (const cubeDir of cubeDirs) {
        const cubePath = path.join(runPath, cubeDir);

        // Look for output.csv
        const outputCsv = path.join(cubePath, 'output.csv');
        // Look for *_predictions.csv (initial format)
        const predictionFiles = fs.readdirSync(cubePath).filter(f => f.endsWith('_predictions.csv'));

        let transactions: Transaction[] = [];

        if (fs.existsSync(outputCsv)) {
          transactions = processOutputCSV(outputCsv, cubeDir, testSetName, runDir);
          console.log(`    ${cubeDir}: ${transactions.length} transactions (output.csv)`);
        } else if (predictionFiles.length > 0) {
          const predFile = path.join(cubePath, predictionFiles[0]);
          transactions = processPredictionsCSV(predFile, cubeDir, testSetName, runDir);
          console.log(`    ${cubeDir}: ${transactions.length} transactions (predictions.csv)`);
        } else {
          console.log(`    ${cubeDir}: no data files found`);
          continue;
        }

        cubes.push({ cube: cubeDir, transactions });
        allTransactions.push(...transactions);
      }

      if (cubes.length === 0) continue;

      // Compute summary
      const byCube: Record<string, any> = {};
      for (const c of cubes) {
        byCube[c.cube] = computeLevelAccuracy(c.transactions);
      }

      runs.push({
        id: runDir,
        testSet: testSetName,
        cubes,
        summary: {
          totalTransactions: allTransactions.length,
          overallAccuracy: computeLevelAccuracy(allTransactions),
          byCube,
        },
      });
    }

    if (runs.length > 0) {
      testSets.push({ name: testSetName, runs });
    }
  }

  // Process AP classifier data (root-level expected.txt vs classified CSV) as PRIMARY dataset
  const expectedTxtPath = path.join(evalsRoot, 'expected.txt');
  const classifiedCsvPath = path.join(evalsRoot, 'classified (2).csv');

  if (fs.existsSync(expectedTxtPath) && fs.existsSync(classifiedCsvPath)) {
    console.log('\nProcessing AP classifier data (primary dataset)...');
    const expectedLines = fs.readFileSync(expectedTxtPath, 'utf-8')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const classifiedRows = parseCSVWithPython(classifiedCsvPath);
    const apTransactions: Transaction[] = [];

    // Group transactions by company for cube-level analysis
    const companyTransactions = new Map<string, Transaction[]>();

    for (let i = 0; i < classifiedRows.length; i++) {
      const row = classifiedRows[i];
      const expectedPath = expectedLines[i] || '';
      const classificationPath = getStr(row, 'classification_path');
      const correctness = calculateCorrectness(expectedPath, classificationPath);
      const expectedLevels = splitPath(expectedPath);
      const predictedLevels = splitPath(classificationPath);
      const maxLevel = expectedLevels.length;
      const company = getStr(row, 'company');
      // Use a short company identifier for the cube field
      const cubeId = company ? company.split(' ')[0] : 'unknown';

      const txn: Transaction = {
        id: `ap-classifier/current/${cubeId}/${i + 1}`,
        rowIndex: i + 1,
        cube: cubeId,
        testSet: 'ap-classifier',
        runId: 'current',
        expectedPath,
        predictedPath: classificationPath,
        expectedLevels,
        predictedLevels,
        correctnessScore: correctness,
        isExactMatch: correctness >= maxLevel && maxLevel > 0,
        supplierName: getStr(row, 'canonical_supplier_name'),
        lineDescription: getStr(row, 'line_description'),
        amount: getNum(row, 'spend_amount'),
        department: company,
        costCenter: getStr(row, 'cost_center'),
        glDescription: getStr(row, 'gl_description'),
        invoiceDate: getStr(row, 'invoice_date'),
        reasoning: getStr(row, 'classification_reasoning'),
        error: '',
        supplierProfile: null,
        columnsUsed: {},
        classificationStatus: getStr(row, 'classification_status'),
        memo: getStr(row, 'memo'),
        company,
      };

      apTransactions.push(txn);

      const cubeList = companyTransactions.get(cubeId) ?? [];
      cubeList.push(txn);
      companyTransactions.set(cubeId, cubeList);
    }

    // Build cubes array from company groups
    const apCubes: any[] = [];
    for (const [cube, txns] of companyTransactions) {
      apCubes.push({ cube, transactions: txns });
    }

    // Compute summary
    const apByCube: Record<string, any> = {};
    for (const c of apCubes) {
      apByCube[c.cube] = computeLevelAccuracy(c.transactions);
    }

    // Insert as FIRST test set so it's the primary/default
    testSets.unshift({
      name: 'ap-classifier',
      runs: [{
        id: 'current',
        testSet: 'ap-classifier',
        cubes: apCubes,
        summary: {
          totalTransactions: apTransactions.length,
          overallAccuracy: computeLevelAccuracy(apTransactions),
          byCube: apByCube,
        },
      }],
    });

    console.log(`  ${apTransactions.length} AP classifier transactions processed`);
    console.log(`  ${companyTransactions.size} companies (cubes)`);
  }

  // Compute total counts
  let totalTransactions = 0;
  let totalRuns = 0;
  for (const ts of testSets) {
    totalRuns += ts.runs.length;
    for (const run of ts.runs) {
      totalTransactions += run.summary.totalTransactions;
    }
  }

  const output = {
    testSets,
    secondaryData: [], // Kept for backward compat, data is now in testSets
    metadata: {
      generatedAt: new Date().toISOString(),
      totalTransactions,
      totalRuns,
    },
  };

  const outputPath = path.join(outputDir, 'eval-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  const fileSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  console.log(`\n=== Done ===`);
  console.log(`Output: ${outputPath} (${fileSizeMB} MB)`);
  console.log(`Test sets: ${testSets.length}`);
  console.log(`Runs: ${totalRuns}`);
  console.log(`Transactions: ${totalTransactions}`);
  console.log(`AP classifier transactions included: yes`);
}

main();
