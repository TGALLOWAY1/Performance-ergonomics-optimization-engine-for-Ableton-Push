import React, { useState, useCallback, useRef } from 'react';
import { Voice } from '../types/layout';
import { processMidiFiles } from '../utils/midiImport';

interface ImportWizardProps {
  /** Existing Voices to check for conflicts */
  existingSounds: Voice[];
  /** Callback when import is confirmed with final Voices */
  onConfirm: (assets: Voice[]) => void;
  /** Callback when import is cancelled */
  onCancel: () => void;
}

interface StagedAsset extends Voice {
  /** Temporary name that can be edited before import */
  tempName: string;
  /** Whether this Voice has a naming conflict */
  hasConflict: boolean;
}

/**
 * ImportWizard component for batch importing MIDI files with smart naming.
 * Extracts unique Voices (MIDI pitches) from MIDI files and shows a preview/staging area
 * where users can review and rename Voices before importing.
 */
export const ImportWizard: React.FC<ImportWizardProps> = ({
  existingSounds,
  onConfirm,
  onCancel,
}) => {
  const [stagedAssets, setStagedAssets] = useState<StagedAsset[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Checks if a name conflicts with existing Voices and returns a unique name.
   */
  const resolveConflict = (name: string, existingNames: Set<string>): string => {
    if (!existingNames.has(name)) {
      return name;
    }
    
    let counter = 1;
    let newName = `${name} (${counter})`;
    while (existingNames.has(newName)) {
      counter++;
      newName = `${name} (${counter})`;
    }
    return newName;
  };

  /**
   * Processes files and stages them for preview.
   * FIX: Collect all assets first, then perform a single state update to prevent overwrite bug.
   */
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    try {
      const fileArray = Array.from(files);
      
      // FIX: Process all files and collect ALL assets into a single array
      const allAssets: Voice[] = [];
      
      for (const file of fileArray) {
        try {
          // Process each file individually to get all sounds from multi-track MIDI files
          const fileAssets = await processMidiFiles([file]);
          allAssets.push(...fileAssets); // Accumulate all assets
        } catch (err) {
          console.error(`Failed to process file ${file.name}:`, err);
          // Continue processing other files even if one fails
        }
      }

      // Get existing sound names for conflict checking
      const existingNames = new Set(existingSounds.map(s => s.name));

      // Create staged assets with conflict resolution
      // FIX: Process all collected assets in a single batch
      const staged: StagedAsset[] = allAssets.map((asset) => {
        const resolvedName = resolveConflict(asset.name, existingNames);
        const hasConflict = resolvedName !== asset.name;
        
        // Add resolved name to set for subsequent conflict checks
        existingNames.add(resolvedName);

        return {
          ...asset,
          tempName: resolvedName,
          hasConflict,
        };
      });

      // FIX: Single state update with all assets to prevent overwrite
      setStagedAssets(staged);
    } catch (err) {
      console.error('Failed to process MIDI files:', err);
      alert(`Failed to process MIDI files: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [existingSounds]);

  /**
   * Handles file input change.
   */
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    // Reset input so same file can be selected again
    if (event.target) {
      event.target.value = '';
    }
  };

  /**
   * Handles drag and drop events.
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  /**
   * Handles clicking the drop zone to open file picker.
   */
  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Updates a staged asset's temporary name.
   */
  const updateStagedAssetName = (id: string, newName: string) => {
    setStagedAssets((prev) =>
      prev.map((asset) => {
        if (asset.id === id) {
          // Check for conflicts with other staged assets and existing sounds
          const allNames = new Set([
            ...existingSounds.map(s => s.name),
            ...prev.filter(a => a.id !== id).map(a => a.tempName),
          ]);
          const resolvedName = resolveConflict(newName, allNames);
          return {
            ...asset,
            tempName: resolvedName,
            hasConflict: resolvedName !== newName,
          };
        }
        return asset;
      })
    );
  };

  /**
   * Removes a staged asset from the preview.
   * FIX: Restore delete functionality.
   */
  const removeStagedAsset = (id: string) => {
    setStagedAssets((prev) => prev.filter((asset) => asset.id !== id));
  };

  /**
   * Confirms import with final asset names.
   */
  const handleConfirm = () => {
    const finalAssets: Voice[] = stagedAssets.map(({ tempName, hasConflict, ...asset }) => ({
      ...asset,
      name: tempName,
    }));
    onConfirm(finalAssets);
  };

  /**
   * Clears staged assets and shows drop zone again.
   */
  const handleClear = () => {
    setStagedAssets([]);
  };

  // If assets are staged, show preview modal
  if (stagedAssets.length > 0) {
    const uniqueFiles = new Set(stagedAssets.map(a => a.sourceFile)).size;
    const totalSounds = stagedAssets.length;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-slate-200">Import Preview</h2>
            <p className="text-sm text-slate-400 mt-1">
              Found {uniqueFiles} file{uniqueFiles !== 1 ? 's' : ''} containing {totalSounds} unique sound{totalSounds !== 1 ? 's' : ''}.
            </p>
          </div>

          {/* Asset List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {stagedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 p-3 bg-slate-900 rounded border border-slate-700"
                >
                  <div
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ backgroundColor: asset.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={asset.tempName}
                      onChange={(e) => updateStagedAssetName(asset.id, e.target.value)}
                      className={`w-full px-2 py-1 text-sm bg-slate-800 border rounded text-slate-200 ${
                        asset.hasConflict
                          ? 'border-yellow-500'
                          : 'border-slate-600'
                      }`}
                      placeholder="Asset name"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      {asset.sourceFile}
                      {asset.originalMidiNote !== null && ` • Note ${asset.originalMidiNote}`}
                      {asset.hasConflict && (
                        <span className="text-yellow-500 ml-2">(renamed to avoid conflict)</span>
                      )}
                    </div>
                  </div>
                  {/* FIX: Restore delete button */}
                  <button
                    onClick={() => removeStagedAsset(asset.id)}
                    className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                    title="Remove from import"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
            >
              Clear
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Import {totalSounds} Sound{totalSounds !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show drop zone
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-slate-200">Import MIDI Files</h2>
          <p className="text-sm text-slate-400 mt-1">
            Drop MIDI files or click to browse. Multiple files are supported.
          </p>
        </div>

        {/* Drop Zone */}
        <div className="p-6">
          <div
            onClick={handleDropZoneClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragOver
                ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                : 'border-slate-600 hover:border-slate-500 hover:bg-slate-900'
              }
              ${isProcessing ? 'opacity-50 cursor-wait' : ''}
            `}
          >
            {isProcessing ? (
              <div className="text-slate-400">
                <div className="animate-spin inline-block w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full mb-2" />
                <p>Processing files...</p>
              </div>
            ) : (
              <>
                <svg
                  className="mx-auto h-12 w-12 text-slate-500 mb-4"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-4h12m-4 4v12m0 0v-4m0 4h-4"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-slate-300 mb-1">Drop MIDI files here</p>
                <p className="text-sm text-slate-500">or click to browse</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mid,.midi"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

