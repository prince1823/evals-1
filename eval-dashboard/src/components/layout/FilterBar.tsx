import { useState, useRef, useEffect } from 'react';
import { useEvalData } from '@/hooks/useEvalData';
import { UploadModal } from '@/components/upload/UploadModal';
import { Plus, ChevronDown, X } from 'lucide-react';

export function FilterBar() {
  const {
    filters,
    setFilters,
    availableTestSets,
    availableSuppliers,
    addTestSet,
    removeTestSet,
    datasetDisplayNames,
    uploadedDatasets,
  } = useEvalData();

  const [showUpload, setShowUpload] = useState(false);
  const [showDatasetMenu, setShowDatasetMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowDatasetMenu(false);
      }
    }
    if (showDatasetMenu) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showDatasetMenu]);

  const currentDisplayName =
    datasetDisplayNames[filters.testSet] || filters.testSet || 'Select Dataset';

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-wrap">
        {/* Dataset Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 uppercase">Dataset</label>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowDatasetMenu(!showDatasetMenu)}
              className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white hover:bg-gray-50 min-w-[180px]"
            >
              <span className="truncate font-medium text-gray-800">{currentDisplayName}</span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0 ml-auto" />
            </button>

            {showDatasetMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[220px] py-1">
                {availableTestSets
                  .filter((ts) => ts === 'ap-classifier' || uploadedDatasets.has(ts))
                  .map((ts) => (
                  <div
                    key={ts}
                    className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${
                      filters.testSet === ts ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <span
                      className="truncate flex-1"
                      onClick={() => {
                        setFilters({ testSet: ts, runId: 'all', cube: 'all', supplier: 'all' });
                        setShowDatasetMenu(false);
                      }}
                    >
                      {datasetDisplayNames[ts] || ts}
                    </span>
                    {uploadedDatasets.has(ts) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTestSet(ts);
                          setShowDatasetMenu(false);
                        }}
                        className="text-gray-400 hover:text-red-500 ml-2 shrink-0"
                        title="Remove dataset"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setShowDatasetMenu(false);
                      setShowUpload(true);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add New Dataset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick add button */}
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            title="Add new dataset"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Supplier filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 uppercase">Supplier</label>
          <select
            value={filters.supplier}
            onChange={(e) => setFilters({ supplier: e.target.value })}
            className="border border-gray-300 rounded px-2 py-1 text-sm bg-white max-w-[220px]"
          >
            <option value="all">All Suppliers</option>
            {availableSuppliers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="text"
            placeholder="Search supplier, description..."
            value={filters.searchQuery}
            onChange={(e) => setFilters({ searchQuery: e.target.value })}
            className="border border-gray-300 rounded px-3 py-1 text-sm w-64"
          />
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onComplete={(testSet, displayName) => {
          addTestSet(testSet, displayName);
          setShowUpload(false);
        }}
      />
    </>
  );
}
