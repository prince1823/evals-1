import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { parseUploadedFiles, previewFiles } from '@/utils/parseUpload';
import type { TestSet } from '@/types/data';

interface LandingPageProps {
  onComplete: (testSet: TestSet, displayName: string) => void;
}

export function LandingPage({ onComplete }: LandingPageProps) {
  const [datasetName, setDatasetName] = useState('');
  const [classifiedFile, setClassifiedFile] = useState<File | null>(null);
  const [expectedFile, setExpectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    classifiedRowCount: number;
    expectedLineCount: number;
    classifiedColumns: string[];
    sampleRows: { expected: string; predicted: string; supplier: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const classifiedRef = useRef<HTMLInputElement>(null);
  const expectedRef = useRef<HTMLInputElement>(null);

  const tryPreview = useCallback(
    async (cf: File | null, ef: File | null) => {
      if (!cf || !ef) {
        setPreview(null);
        return;
      }
      setPreviewLoading(true);
      setError(null);
      try {
        const p = await previewFiles(cf, ef);
        setPreview(p);
        if (p.classifiedRowCount !== p.expectedLineCount) {
          setError(
            `Row count mismatch: classified has ${p.classifiedRowCount} rows, expected has ${p.expectedLineCount} lines. The first ${Math.min(p.classifiedRowCount, p.expectedLineCount)} will be used.`,
          );
        }
      } catch (err: any) {
        setError(err.message);
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    [],
  );

  const handleClassifiedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      setClassifiedFile(file);
      setError(null);
      if (!datasetName && file) {
        setDatasetName(file.name.replace(/\.(csv|txt)$/i, ''));
      }
      tryPreview(file, expectedFile);
    },
    [expectedFile, datasetName, tryPreview],
  );

  const handleExpectedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      setExpectedFile(file);
      setError(null);
      tryPreview(classifiedFile, file);
    },
    [classifiedFile, tryPreview],
  );

  const handleAnalyze = useCallback(async () => {
    if (!classifiedFile || !expectedFile || !datasetName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await parseUploadedFiles(classifiedFile, expectedFile, datasetName.trim());
      onComplete(result.testSet, datasetName.trim());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [classifiedFile, expectedFile, datasetName, onComplete]);

  const canAnalyze = classifiedFile && expectedFile && datasetName.trim() && !loading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AP Classifier Eval Dashboard</h1>
          <p className="text-gray-500 mt-2">
            Upload your classified output and expected results to analyze accuracy
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Dataset Name */}
          <div className="px-8 pt-8 pb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Dataset Name</label>
            <input
              type="text"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="e.g., AP Classifier Run v1"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* File Upload Zones */}
          <div className="px-8 pb-6">
            <div className="grid grid-cols-2 gap-5">
              {/* Classified File */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Classified File
                  <span className="text-gray-400 font-normal ml-1">(CSV)</span>
                </label>
                <p className="text-xs text-gray-400 mb-2">AI classifier output with predictions</p>
                <input
                  ref={classifiedRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleClassifiedChange}
                  className="hidden"
                />
                <button
                  onClick={() => classifiedRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    classifiedFile
                      ? 'border-green-300 bg-green-50 hover:bg-green-100'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {classifiedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-green-600" />
                      <span className="text-sm text-green-700 font-medium truncate max-w-full">
                        {classifiedFile.name}
                      </span>
                      <span className="text-xs text-gray-400">Click to change</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-gray-400" />
                      <span className="text-sm text-gray-500 font-medium">Choose file</span>
                      <span className="text-xs text-gray-400">CSV or TXT</span>
                    </div>
                  )}
                </button>
              </div>

              {/* Expected File */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Expected File
                  <span className="text-gray-400 font-normal ml-1">(CSV/TXT)</span>
                </label>
                <p className="text-xs text-gray-400 mb-2">Ground truth — TXT (one path per line) or CSV with Level columns</p>
                <input
                  ref={expectedRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleExpectedChange}
                  className="hidden"
                />
                <button
                  onClick={() => expectedRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                    expectedFile
                      ? 'border-green-300 bg-green-50 hover:bg-green-100'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {expectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-green-600" />
                      <span className="text-sm text-green-700 font-medium truncate max-w-full">
                        {expectedFile.name}
                      </span>
                      <span className="text-xs text-gray-400">Click to change</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-gray-400" />
                      <span className="text-sm text-gray-500 font-medium">Choose file</span>
                      <span className="text-xs text-gray-400">CSV or TXT</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Preview Loading */}
          {previewLoading && (
            <div className="px-8 pb-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading files...
              </div>
            </div>
          )}

          {/* Preview */}
          {preview && !previewLoading && (
            <div className="px-8 pb-4">
              <div className="bg-gray-50 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Files parsed successfully
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white rounded-lg px-4 py-2.5 border border-gray-100">
                    <span className="text-gray-500">Classified rows:</span>{' '}
                    <span className="font-semibold text-gray-800">{preview.classifiedRowCount}</span>
                  </div>
                  <div className="bg-white rounded-lg px-4 py-2.5 border border-gray-100">
                    <span className="text-gray-500">Expected lines:</span>{' '}
                    <span className="font-semibold text-gray-800">{preview.expectedLineCount}</span>
                  </div>
                </div>
                {preview.sampleRows.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Sample rows:</p>
                    <div className="space-y-1.5">
                      {preview.sampleRows.map((row, i) => (
                        <div key={i} className="bg-white rounded-lg px-4 py-2 text-xs border border-gray-100">
                          <div className="flex gap-2">
                            <span className="text-gray-400 shrink-0">#{i + 1}</span>
                            <span className="text-gray-700 font-medium truncate" title={row.supplier}>
                              {row.supplier || '(no supplier)'}
                            </span>
                          </div>
                          <div className="mt-1 text-green-700 truncate" title={row.expected}>
                            Expected: {row.expected}
                          </div>
                          <div className="text-blue-700 truncate" title={row.predicted}>
                            Predicted: {row.predicted}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-8 pb-4">
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Action */}
          <div className="px-8 py-5 bg-gray-50 border-t border-gray-100">
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className={`w-full py-3 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors ${
                canAnalyze
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Analyze & View Dashboard
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Help text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            The classified file should contain columns like <code className="bg-gray-200 px-1 rounded">classification_path</code>, <code className="bg-gray-200 px-1 rounded">canonical_supplier_name</code>, etc.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            The expected file can be a TXT with one path per line in <code className="bg-gray-200 px-1 rounded">level1|level2|level3</code> format, or a CSV with <code className="bg-gray-200 px-1 rounded">Level 1</code>, <code className="bg-gray-200 px-1 rounded">Level 2</code>, <code className="bg-gray-200 px-1 rounded">Level 3</code> columns.
          </p>
        </div>
      </div>
    </div>
  );
}
