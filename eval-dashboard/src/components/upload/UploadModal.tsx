import { useState, useCallback, useRef } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { parseUploadedFiles, previewFiles } from '@/utils/parseUpload';
import type { TestSet } from '@/types/data';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (testSet: TestSet, displayName: string) => void;
}

export function UploadModal({ open, onClose, onComplete }: UploadModalProps) {
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
      // Reset state
      setDatasetName('');
      setClassifiedFile(null);
      setExpectedFile(null);
      setPreview(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [classifiedFile, expectedFile, datasetName, onComplete]);

  const handleClose = useCallback(() => {
    setDatasetName('');
    setClassifiedFile(null);
    setExpectedFile(null);
    setPreview(null);
    setError(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const canAnalyze = classifiedFile && expectedFile && datasetName.trim() && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add New Dataset</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Dataset Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dataset Name</label>
            <input
              type="text"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              placeholder="e.g., My Run v2"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* File Inputs */}
          <div className="grid grid-cols-2 gap-4">
            {/* Classified File */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Classified File
              </label>
              <input
                ref={classifiedRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleClassifiedChange}
                className="hidden"
              />
              <button
                onClick={() => classifiedRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                  classifiedFile
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                {classifiedFile ? (
                  <div className="flex flex-col items-center gap-1">
                    <FileText className="h-6 w-6 text-green-600" />
                    <span className="text-xs text-green-700 font-medium truncate max-w-full">
                      {classifiedFile.name}
                    </span>
                    <span className="text-xs text-gray-400">Click to change</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-6 w-6 text-gray-400" />
                    <span className="text-xs text-gray-500">CSV or TXT</span>
                  </div>
                )}
              </button>
            </div>

            {/* Expected File */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected File</label>
              <input
                ref={expectedRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleExpectedChange}
                className="hidden"
              />
              <button
                onClick={() => expectedRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                  expectedFile
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                {expectedFile ? (
                  <div className="flex flex-col items-center gap-1">
                    <FileText className="h-6 w-6 text-green-600" />
                    <span className="text-xs text-green-700 font-medium truncate max-w-full">
                      {expectedFile.name}
                    </span>
                    <span className="text-xs text-gray-400">Click to change</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-6 w-6 text-gray-400" />
                    <span className="text-xs text-gray-500">CSV or TXT</span>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Preview Loading */}
          {previewLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading files...
            </div>
          )}

          {/* Preview */}
          {preview && !previewLoading && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Files parsed successfully
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white rounded px-3 py-2">
                  <span className="text-gray-500">Classified rows:</span>{' '}
                  <span className="font-semibold">{preview.classifiedRowCount}</span>
                </div>
                <div className="bg-white rounded px-3 py-2">
                  <span className="text-gray-500">Expected lines:</span>{' '}
                  <span className="font-semibold">{preview.expectedLineCount}</span>
                </div>
              </div>
              {preview.sampleRows.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Sample rows:</p>
                  <div className="space-y-1">
                    {preview.sampleRows.map((row, i) => (
                      <div key={i} className="bg-white rounded px-3 py-1.5 text-xs">
                        <div className="flex gap-2">
                          <span className="text-gray-400 shrink-0">#{i + 1}</span>
                          <span className="text-gray-600 truncate" title={row.supplier}>
                            {row.supplier || '(no supplier)'}
                          </span>
                        </div>
                        <div className="mt-0.5 text-green-700 truncate" title={row.expected}>
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
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className={`px-5 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
              canAnalyze
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>
    </div>
  );
}
