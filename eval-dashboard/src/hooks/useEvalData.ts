import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ProcessedData, Transaction, FilterState, TestSet } from '@/types/data';

interface EvalDataContextValue {
  data: ProcessedData | null;
  loading: boolean;
  error: string | null;
  filters: FilterState;
  setFilters: (partial: Partial<FilterState>) => void;
  filteredTransactions: Transaction[];
  allTransactions: Transaction[];
  availableTestSets: string[];
  availableRuns: { id: string; testSet: string }[];
  availableCubes: string[];
  availableSuppliers: string[];
  /** Add an uploaded dataset and switch to it */
  addTestSet: (testSet: TestSet, displayName: string) => void;
  /** Remove an uploaded dataset */
  removeTestSet: (name: string) => void;
  /** Map of dataset name → display name (for uploaded datasets) */
  datasetDisplayNames: Record<string, string>;
  /** Set of uploaded dataset names (not pre-loaded) */
  uploadedDatasets: Set<string>;
}

const defaultFilters: FilterState = {
  testSet: 'all',
  runId: 'all',
  cube: 'all',
  supplier: 'all',
  correctnessScores: [0, 1, 2, 3],
  searchQuery: '',
};

export const EvalDataContext = createContext<EvalDataContextValue>({
  data: null,
  loading: false,
  error: null,
  filters: defaultFilters,
  setFilters: () => {},
  filteredTransactions: [],
  allTransactions: [],
  availableTestSets: [],
  availableRuns: [],
  availableCubes: [],
  availableSuppliers: [],
  addTestSet: () => {},
  removeTestSet: () => {},
  datasetDisplayNames: {},
  uploadedDatasets: new Set(),
});

export function useEvalData() {
  return useContext(EvalDataContext);
}

export function useEvalDataProvider() {
  const [data, setData] = useState<ProcessedData | null>(null);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<FilterState>(defaultFilters);
  const [uploadedDatasets, setUploadedDatasets] = useState<Set<string>>(new Set());
  const [datasetDisplayNames, setDatasetDisplayNames] = useState<Record<string, string>>({});

  const setFilters = useCallback((partial: Partial<FilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }, []);

  const addTestSet = useCallback(
    (testSet: TestSet, displayName: string) => {
      setData((prev) => {
        const totalNew = testSet.runs.reduce((sum, r) => sum + r.summary.totalTransactions, 0);
        if (!prev) {
          // First upload — initialize ProcessedData
          return {
            testSets: [testSet],
            secondaryData: [],
            metadata: {
              generatedAt: new Date().toISOString(),
              totalTransactions: totalNew,
              totalRuns: testSet.runs.length,
            },
          };
        }
        // Subsequent uploads — merge into existing
        const filtered = prev.testSets.filter((ts) => ts.name !== testSet.name);
        return {
          ...prev,
          testSets: [...filtered, testSet],
          metadata: {
            ...prev.metadata,
            totalTransactions: prev.metadata.totalTransactions + totalNew,
          },
        };
      });
      setUploadedDatasets((prev) => new Set([...prev, testSet.name]));
      setDatasetDisplayNames((prev) => ({ ...prev, [testSet.name]: displayName }));
      // Auto-switch to the new dataset
      setFiltersState({
        testSet: testSet.name,
        runId: 'all',
        cube: 'all',
        supplier: 'all',
        correctnessScores: [0, 1, 2, 3],
        searchQuery: '',
      });
    },
    [],
  );

  const removeTestSet = useCallback(
    (name: string) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          testSets: prev.testSets.filter((ts) => ts.name !== name),
        };
      });
      setUploadedDatasets((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      setDatasetDisplayNames((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      // Switch to 'all' if removing current dataset
      setFiltersState((prev) => {
        if (prev.testSet === name) {
          return { ...prev, testSet: 'all', runId: 'all', cube: 'all', supplier: 'all' };
        }
        return prev;
      });
    },
    [],
  );

  const allTransactions = useMemo(() => {
    if (!data) return [];
    const txns: Transaction[] = [];
    for (const ts of data.testSets) {
      for (const run of ts.runs) {
        for (const cube of run.cubes) {
          txns.push(...cube.transactions);
        }
      }
    }
    return txns;
  }, [data]);

  const filteredTransactions = useMemo(() => {
    let txns = allTransactions;
    if (filters.testSet !== 'all') {
      txns = txns.filter((t) => t.testSet === filters.testSet);
    }
    if (filters.runId !== 'all') {
      txns = txns.filter((t) => t.runId === filters.runId);
    }
    if (filters.cube !== 'all') {
      txns = txns.filter((t) => t.cube === filters.cube);
    }
    if (filters.supplier !== 'all') {
      txns = txns.filter((t) => t.supplierName === filters.supplier);
    }
    if (filters.correctnessScores.length < 4) {
      txns = txns.filter((t) => filters.correctnessScores.includes(t.correctnessScore));
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      txns = txns.filter(
        (t) =>
          t.supplierName.toLowerCase().includes(q) ||
          t.lineDescription.toLowerCase().includes(q) ||
          t.expectedPath.toLowerCase().includes(q) ||
          t.predictedPath.toLowerCase().includes(q),
      );
    }
    return txns;
  }, [allTransactions, filters]);

  const availableTestSets = useMemo(() => {
    if (!data) return [];
    return data.testSets.map((ts) => ts.name);
  }, [data]);

  const availableRuns = useMemo(() => {
    if (!data) return [];
    const runs: { id: string; testSet: string }[] = [];
    for (const ts of data.testSets) {
      if (filters.testSet !== 'all' && ts.name !== filters.testSet) continue;
      for (const run of ts.runs) {
        runs.push({ id: run.id, testSet: ts.name });
      }
    }
    return runs;
  }, [data, filters.testSet]);

  const availableCubes = useMemo(() => {
    if (!data) return [];
    const cubeSet = new Set<string>();
    for (const ts of data.testSets) {
      if (filters.testSet !== 'all' && ts.name !== filters.testSet) continue;
      for (const run of ts.runs) {
        if (filters.runId !== 'all' && run.id !== filters.runId) continue;
        for (const cube of run.cubes) {
          cubeSet.add(cube.cube);
        }
      }
    }
    return Array.from(cubeSet).sort();
  }, [data, filters.testSet, filters.runId]);

  const availableSuppliers = useMemo(() => {
    if (!data) return [];
    const supplierSet = new Set<string>();
    for (const ts of data.testSets) {
      if (filters.testSet !== 'all' && ts.name !== filters.testSet) continue;
      for (const run of ts.runs) {
        if (filters.runId !== 'all' && run.id !== filters.runId) continue;
        for (const cube of run.cubes) {
          if (filters.cube !== 'all' && cube.cube !== filters.cube) continue;
          for (const t of cube.transactions) {
            if (t.supplierName) supplierSet.add(t.supplierName);
          }
        }
      }
    }
    return Array.from(supplierSet).sort();
  }, [data, filters.testSet, filters.runId, filters.cube]);

  return {
    data,
    loading,
    error,
    filters,
    setFilters,
    filteredTransactions,
    allTransactions,
    availableTestSets,
    availableRuns,
    availableCubes,
    availableSuppliers,
    addTestSet,
    removeTestSet,
    datasetDisplayNames,
    uploadedDatasets,
  };
}
