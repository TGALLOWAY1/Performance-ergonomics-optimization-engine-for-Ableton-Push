/**
 * NaturalHandPosePanel Component
 * 
 * UI for editing the Natural Hand Pose (Pose 0) - the user's preferred
 * resting hand position on the Push 3 grid.
 * 
 * Features:
 * - Active finger tool: click finger, then click pad to assign
 * - Keyboard shortcuts: 1-5 for left hand, 6-0 for right hand
 * - Preview offset: signed [-4, +4] to shift pose vertically
 * - Built-in default pose; edit via finger palette
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  NaturalHandPose,
  FingerId,
  ALL_FINGER_IDS,
  PadCoord,
  normalizePose0,
  validateNaturalHandPose,
  poseHasAssignments,
  getAssignedFingerCount,
  getPose0PadsWithOffset,
  getMaxSafeOffset,
  isOffsetSafe,
} from '../types/naturalHandPose';
import { cellKey } from '../types/layout';

// ============================================================================
// Types
// ============================================================================

interface NaturalHandPosePanelProps {
  /** Current Pose 0 from project state */
  pose0: NaturalHandPose;
  /** Callback to update Pose 0 */
  onUpdatePose0: (pose: NaturalHandPose) => void;
  /** Currently active finger tool (null = no tool selected) */
  activeFinger: FingerId | null;
  /** Callback to set active finger tool */
  onSetActiveFinger: (finger: FingerId | null) => void;
  /** Preview offset for visualization */
  previewOffset: number;
  /** Callback to set preview offset */
  onSetPreviewOffset: (offset: number) => void;
  /** Whether pose edit mode is active */
  isEditMode: boolean;
  /** Callback to toggle edit mode */
  onToggleEditMode: () => void;
}

// ============================================================================
// Finger Display Helpers
// ============================================================================

/** Short display name for finger (e.g., "L1" for L_THUMB) */
function getFingerShortName(fingerId: FingerId): string {
  const fingerNum: Record<string, number> = {
    THUMB: 1,
    INDEX: 2,
    MIDDLE: 3,
    RING: 4,
    PINKY: 5,
  };
  const hand = fingerId.startsWith('L_') ? 'L' : 'R';
  const fingerPart = fingerId.split('_')[1];
  return `${hand}${fingerNum[fingerPart]}`;
}

/** Full display name for finger (e.g., "Left Thumb") */
function getFingerDisplayName(fingerId: FingerId): string {
  const hand = fingerId.startsWith('L_') ? 'Left' : 'Right';
  const fingerPart = fingerId.split('_')[1];
  const fingerName = fingerPart.charAt(0) + fingerPart.slice(1).toLowerCase();
  return `${hand} ${fingerName}`;
}

/** Get finger color based on hand and finger type */
function getFingerColor(fingerId: FingerId): string {
  // Use CSS variables matching the existing finger legend
  const isLeft = fingerId.startsWith('L_');
  const fingerNum: Record<string, number> = {
    THUMB: 1,
    INDEX: 2,
    MIDDLE: 3,
    RING: 4,
    PINKY: 5,
  };
  const num = fingerNum[fingerId.split('_')[1]];
  return `var(--finger-${isLeft ? 'L' : 'R'}${num})`;
}

/** Keyboard shortcut for finger (1-5 left, 6-0 right) */
function getFingerShortcut(fingerId: FingerId): string {
  const shortcuts: Record<FingerId, string> = {
    L_THUMB: '1',
    L_INDEX: '2',
    L_MIDDLE: '3',
    L_RING: '4',
    L_PINKY: '5',
    R_THUMB: '6',
    R_INDEX: '7',
    R_MIDDLE: '8',
    R_RING: '9',
    R_PINKY: '0',
  };
  return shortcuts[fingerId];
}

/** Map keyboard key to FingerId */
function keyToFingerId(key: string): FingerId | null {
  const keyMap: Record<string, FingerId> = {
    '1': 'L_THUMB',
    '2': 'L_INDEX',
    '3': 'L_MIDDLE',
    '4': 'L_RING',
    '5': 'L_PINKY',
    '6': 'R_THUMB',
    '7': 'R_INDEX',
    '8': 'R_MIDDLE',
    '9': 'R_RING',
    '0': 'R_PINKY',
  };
  return keyMap[key] || null;
}

// ============================================================================
// Component
// ============================================================================

export const NaturalHandPosePanel: React.FC<NaturalHandPosePanelProps> = ({
  pose0,
  onUpdatePose0,
  activeFinger,
  onSetActiveFinger,
  previewOffset,
  onSetPreviewOffset,
  isEditMode,
  onToggleEditMode,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Calculate max safe offset for current pose
  const maxSafePositive = getMaxSafeOffset(pose0, true);
  const maxSafeNegative = getMaxSafeOffset(pose0, false);
  const isSafeOffset = isOffsetSafe(pose0, previewOffset);

  // Keyboard shortcuts for finger selection
  useEffect(() => {
    if (!isEditMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Escape clears selection
      if (e.key === 'Escape') {
        onSetActiveFinger(null);
        return;
      }

      // Number keys select fingers
      const fingerId = keyToFingerId(e.key);
      if (fingerId) {
        onSetActiveFinger(fingerId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, onSetActiveFinger]);

  // Clear status message after a delay
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Handle finger button click
  const handleFingerClick = useCallback((fingerId: FingerId) => {
    if (activeFinger === fingerId) {
      onSetActiveFinger(null); // Toggle off
    } else {
      onSetActiveFinger(fingerId);
    }
  }, [activeFinger, onSetActiveFinger]);

  // Handle saving pose (with normalization)
  const handleSavePose = useCallback(() => {
    const normalized = normalizePose0(pose0);
    const validation = validateNaturalHandPose(normalized);
    
    if (!validation.valid) {
      setStatusMessage(`Error: ${validation.error}`);
      return;
    }

    onUpdatePose0(normalized);
    setStatusMessage('Pose saved successfully');
  }, [pose0, onUpdatePose0]);

  // Handle clearing a single finger
  const handleClearFinger = useCallback((fingerId: FingerId) => {
    const newFingerToPad = { ...pose0.fingerToPad };
    newFingerToPad[fingerId] = null;
    onUpdatePose0({
      ...pose0,
      fingerToPad: newFingerToPad,
      updatedAt: new Date().toISOString(),
    });
  }, [pose0, onUpdatePose0]);

  // Handle clearing all fingers
  const handleClearAll = useCallback(() => {
    const newFingerToPad: Record<FingerId, PadCoord | null> = {} as Record<FingerId, PadCoord | null>;
    for (const fingerId of ALL_FINGER_IDS) {
      newFingerToPad[fingerId] = null;
    }
    onUpdatePose0({
      ...pose0,
      fingerToPad: newFingerToPad,
      updatedAt: new Date().toISOString(),
    });
    setStatusMessage('All finger assignments cleared');
  }, [pose0, onUpdatePose0]);

  // Get pads with current preview offset for display
  const padsWithOffset = getPose0PadsWithOffset(pose0, previewOffset, false);
  const offGridFingers = padsWithOffset.filter(p => p.row < 0 || p.row > 7);

  const assignedCount = getAssignedFingerCount(pose0);
  const hasAssignments = poseHasAssignments(pose0);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Natural Hand Pose
          </h3>
          <button
            onClick={onToggleEditMode}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              isEditMode
                ? 'bg-blue-600 text-white'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            {isEditMode ? 'Done Editing' : 'Edit Pose'}
          </button>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          {assignedCount}/10 fingers assigned
        </p>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className={`px-4 py-2 text-xs ${
          statusMessage.startsWith('Error') 
            ? 'bg-red-900/30 text-red-300' 
            : 'bg-green-900/30 text-green-300'
        }`}>
          {statusMessage}
        </div>
      )}

      {/* Edit Mode Content */}
      {isEditMode && (
        <div className="flex-1 overflow-y-auto">
          {/* Instructions */}
          <div className="px-4 py-3 bg-[var(--bg-card)] border-b border-[var(--border-subtle)]">
            <p className="text-xs text-[var(--text-secondary)]">
              <strong>Click a finger</strong> below, then <strong>click a pad</strong> on the grid to assign.
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Shortcuts: 1-5 (left hand), 6-0 (right hand), Esc (clear)
            </p>
          </div>

          {/* Finger Palette - Left Hand */}
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">Left Hand</h4>
            <div className="flex flex-wrap gap-2">
              {ALL_FINGER_IDS.filter(f => f.startsWith('L_')).map(fingerId => {
                const isActive = activeFinger === fingerId;
                const pad = pose0.fingerToPad[fingerId];
                const hasAssignment = pad !== null && pad !== undefined;

                return (
                  <button
                    key={fingerId}
                    onClick={() => handleFingerClick(fingerId)}
                    className={`relative px-2 py-1.5 text-xs font-medium rounded transition-all ${
                      isActive
                        ? 'ring-2 ring-white shadow-lg scale-105'
                        : 'hover:scale-102'
                    }`}
                    style={{
                      backgroundColor: getFingerColor(fingerId),
                      color: 'white',
                    }}
                    title={`${getFingerDisplayName(fingerId)} (${getFingerShortcut(fingerId)})`}
                  >
                    <span className="flex items-center gap-1">
                      <span>{getFingerShortName(fingerId)}</span>
                      {hasAssignment && (
                        <span className="text-[10px] opacity-75">
                          ({pad.row},{pad.col})
                        </span>
                      )}
                    </span>
                    {hasAssignment && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearFinger(fingerId);
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center hover:bg-red-400"
                        title="Clear assignment"
                      >
                        ×
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Finger Palette - Right Hand */}
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">Right Hand</h4>
            <div className="flex flex-wrap gap-2">
              {ALL_FINGER_IDS.filter(f => f.startsWith('R_')).map(fingerId => {
                const isActive = activeFinger === fingerId;
                const pad = pose0.fingerToPad[fingerId];
                const hasAssignment = pad !== null && pad !== undefined;

                return (
                  <button
                    key={fingerId}
                    onClick={() => handleFingerClick(fingerId)}
                    className={`relative px-2 py-1.5 text-xs font-medium rounded transition-all ${
                      isActive
                        ? 'ring-2 ring-white shadow-lg scale-105'
                        : 'hover:scale-102'
                    }`}
                    style={{
                      backgroundColor: getFingerColor(fingerId),
                      color: 'white',
                    }}
                    title={`${getFingerDisplayName(fingerId)} (${getFingerShortcut(fingerId)})`}
                  >
                    <span className="flex items-center gap-1">
                      <span>{getFingerShortName(fingerId)}</span>
                      {hasAssignment && (
                        <span className="text-[10px] opacity-75">
                          ({pad.row},{pad.col})
                        </span>
                      )}
                    </span>
                    {hasAssignment && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearFinger(fingerId);
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center hover:bg-red-400"
                        title="Clear assignment"
                      >
                        ×
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Tool Indicator */}
          {activeFinger && (
            <div className="px-4 py-2 bg-blue-900/30 border-b border-[var(--border-subtle)]">
              <p className="text-xs text-blue-300">
                Active: <strong>{getFingerDisplayName(activeFinger)}</strong> — click a pad to assign
              </p>
            </div>
          )}

          {/* Preview Offset */}
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-[var(--text-secondary)]">Preview Offset</h4>
              <span className="text-xs text-[var(--text-tertiary)]">
                {previewOffset > 0 ? '+' : ''}{previewOffset} rows
              </span>
            </div>
            <input
              type="range"
              min={-4}
              max={4}
              value={previewOffset}
              onChange={(e) => onSetPreviewOffset(parseInt(e.target.value, 10))}
              className="w-full h-2 bg-[var(--bg-card)] rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-1">
              <span>-4 (down)</span>
              <span>0</span>
              <span>+4 (up)</span>
            </div>
            {!isSafeOffset && offGridFingers.length > 0 && (
              <p className="text-xs text-amber-400 mt-2">
                {offGridFingers.length} finger(s) off-grid at this offset
              </p>
            )}
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Safe range: {maxSafeNegative} to {maxSafePositive > 0 ? '+' : ''}{maxSafePositive}
            </p>
          </div>

          {/* Actions */}
          <div className="px-4 py-3 space-y-2">
            <button
              onClick={handleSavePose}
              disabled={!hasAssignments}
              className="w-full px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save & Normalize Pose
            </button>
            <button
              onClick={handleClearAll}
              disabled={!hasAssignments}
              className="w-full px-3 py-2 text-xs font-medium bg-[var(--bg-card)] text-[var(--text-secondary)] rounded hover:bg-red-900/30 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Clear All Assignments
            </button>
          </div>
        </div>
      )}

      {/* Non-Edit Mode: Summary */}
      {!isEditMode && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3">
            {hasAssignments ? (
              <>
                <p className="text-xs text-[var(--text-secondary)] mb-2">
                  Your natural hand pose is configured. Click "Edit Pose" to modify.
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mb-3">
                  Use <strong>Natural</strong> in the toolbar to assign sounds to these pads first. <strong>Auto-Arrange</strong> and <strong>Run Analysis</strong> use this pose as the preferred home position.
                </p>
                <div className="space-y-2">
                  {ALL_FINGER_IDS.map(fingerId => {
                    const pad = pose0.fingerToPad[fingerId];
                    if (!pad) return null;
                    return (
                      <div
                        key={fingerId}
                        className="flex items-center justify-between px-2 py-1 rounded"
                        style={{ backgroundColor: `${getFingerColor(fingerId)}20` }}
                      >
                        <span className="text-xs text-[var(--text-primary)]">
                          {getFingerDisplayName(fingerId)}
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)]">
                          ({pad.row}, {pad.col})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)] italic">
                No pose configured yet. Click "Edit Pose" to set your natural hand position.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Grid Ghost Markers Helper
// ============================================================================

/**
 * Get ghost marker data for rendering Pose 0 on the grid.
 * Returns a map of cellKey -> { fingerId, isOffGrid }
 */
export function getPoseGhostMarkers(
  pose0: NaturalHandPose,
  previewOffset: number
): Map<string, { fingerId: FingerId; shortName: string; color: string; isOffGrid: boolean }> {
  const markers = new Map<string, { fingerId: FingerId; shortName: string; color: string; isOffGrid: boolean }>();
  
  const padsWithOffset = getPose0PadsWithOffset(pose0, previewOffset, false);
  
  for (const { fingerId, row, col } of padsWithOffset) {
    const isOffGrid = row < 0 || row > 7;
    const clampedRow = Math.max(0, Math.min(7, row));
    const key = cellKey(clampedRow, col);
    
    markers.set(key, {
      fingerId,
      shortName: getFingerShortName(fingerId),
      color: getFingerColor(fingerId),
      isOffGrid,
    });
  }
  
  return markers;
}

/**
 * Handle pad click during pose edit mode.
 * Assigns the active finger to the clicked pad.
 */
export function handlePoseEditPadClick(
  row: number,
  col: number,
  activeFinger: FingerId | null,
  pose0: NaturalHandPose,
  onUpdatePose0: (pose: NaturalHandPose) => void
): { success: boolean; message?: string } {
  if (!activeFinger) {
    return { success: false, message: 'Select a finger first' };
  }

  // Check if this pad is already assigned to another finger
  const existingFinger = Object.entries(pose0.fingerToPad).find(
    ([, pad]) => pad !== null && pad.row === row && pad.col === col
  )?.[0] as FingerId | undefined;

  const newFingerToPad = { ...pose0.fingerToPad };

  // If pad is already assigned to another finger, clear that assignment
  if (existingFinger && existingFinger !== activeFinger) {
    newFingerToPad[existingFinger] = null;
  }

  // Assign active finger to this pad
  newFingerToPad[activeFinger] = { row, col };

  onUpdatePose0({
    ...pose0,
    fingerToPad: newFingerToPad,
    updatedAt: new Date().toISOString(),
  });

  return { success: true };
}
