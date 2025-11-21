import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LayoutSnapshot } from '../types/projectState';
import { SectionMap } from '../data/models';
import { GridMapService } from '../engine/gridMapService';
import { GridPattern } from '../types/gridPattern';
import { EngineResult, EngineDebugEvent, DifficultyLabel } from '../engine/runEngine';
import { formatFinger, normalizeHand } from '../utils/formatUtils';
import { getReachabilityMap, ReachabilityLevel } from '../engine/feasibility';
import { GridPosition } from '../engine/gridMath';
import { FingerID } from '../types/engine';
import { GridMapping } from '../types/layout';
import { getPositionForMidi } from '../utils/layoutUtils';

interface GridEditorProps {
  activeLayout: LayoutSnapshot | null;
  currentStep: number;
  activeSection: SectionMap | null;
  gridPattern: GridPattern | null;
  onTogglePad: (step: number, row: number, col: number) => void;
  showDebugLabels: boolean;
  /** When true, ignore step time and show any Pad that appears in performance.events as active. */
  viewAllSteps: boolean;
  engineResult: EngineResult | null;
  /** When true, show visual dividers for Drum Rack Banks */
  showBankGuides?: boolean;
  /** Optional callback when a Pad is clicked (for selection purposes) */
  onCellClick?: (row: number, col: number) => void;
  /** Active mapping for custom layout (defines Pad-to-Voice Assignments, used in Analysis mode) */
  activeMapping?: GridMapping | null;
  /** When true, grid is read-only and shows Voice info from activeMapping */
  readOnly?: boolean;
  /** Highlighted Pad coordinates (for external highlighting) */
  highlightedCell?: { row: number; col: number } | null;
  /** Callback to update finger constraints for a Pad (for Analysis mode) */
  onUpdateFingerConstraint?: (cellKey: string, constraint: string | null) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const getNoteName = (midiNote: number): string => {
  const note = NOTE_NAMES[midiNote % 12];
  const octave = Math.floor(midiNote / 12) - 2; // MIDI 60 is C3, so 0 is C-2
  return `${note}${octave}`;
};

const DIFFICULTY_RANK: Record<DifficultyLabel, number> = {
  'Easy': 0,
  'Medium': 1,
  'Hard': 2,
  'Unplayable': 3
};

/**
 * Converts FingerID (1-5) to abbreviation (T, I, M, R, P)
 * 1 = Thumb (T), 2 = Index (I), 3 = Middle (M), 4 = Ring (R), 5 = Pinky (P)
 */
const getFingerAbbreviation = (finger: FingerID): string => {
  const map: Record<FingerID, string> = {
    1: 'T',
    2: 'I',
    3: 'M',
    4: 'R',
    5: 'P',
  };
  return map[finger];
};

interface ReachabilityConfig {
  anchorPos: GridPosition;
  anchorFinger: FingerID;
  targetFinger: FingerID;
  hand: 'L' | 'R';
}

export const GridEditor: React.FC<GridEditorProps> = ({
  activeLayout,
  currentStep,
  activeSection,
  gridPattern,
  onTogglePad,
  showDebugLabels,
  viewAllSteps,
  engineResult,
  showBankGuides = false,
  onCellClick,
  activeMapping = null,
  readOnly = false,
  highlightedCell = null,
  onUpdateFingerConstraint
}) => {
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null);
  const [reachabilityConfig, setReachabilityConfig] = useState<ReachabilityConfig | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Generate 8x8 grid (rows 0-7, cols 0-7)
  // Visual: Row 7 is top, Row 0 is bottom
  const rows = Array.from({ length: 8 }, (_, i) => 7 - i);
  const cols = Array.from({ length: 8 }, (_, i) => i);

  // Compute reachability map if active
  const reachabilityMap = reachabilityConfig
    ? getReachabilityMap(
        reachabilityConfig.anchorPos,
        reachabilityConfig.anchorFinger,
        reachabilityConfig.targetFinger
      )
    : null;

  // W4: Calculate per-Pad Cell (MIDI note) count from activeLayout.performance
  const padNoteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    if (!activeLayout || !activeLayout.performance || !activeSection) {
      return counts;
    }

    activeLayout.performance.events.forEach(event => {
      // Use activeMapping if available, otherwise use InstrumentConfig
      let row: number | null = null;
      let col: number | null = null;
      
      if (activeMapping) {
        const pos = getPositionForMidi(event.noteNumber, activeMapping);
        if (pos) {
          row = pos.row;
          col = pos.col;
        }
      } else {
        const pos = GridMapService.noteToGrid(event.noteNumber, activeSection.instrumentConfig);
        if (pos) {
          row = pos[0];
          col = pos[1];
        }
      }
      
      if (row !== null && col !== null) {
        const key = `${row},${col}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    return counts;
  }, [activeLayout, activeSection, activeMapping]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  // Handle right-click to show context menu
  const handleContextMenu = (e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      row,
      col,
    });
  };

  // Handle selecting a finger for reachability visualization
  const handleShowReach = (hand: 'L' | 'R', finger: FingerID) => {
    if (!contextMenu) return;
    
    const anchorPos: GridPosition = {
      row: contextMenu.row,
      col: contextMenu.col,
    };

    setReachabilityConfig({
      anchorPos,
      anchorFinger: finger,
      targetFinger: finger,
      hand,
    });

    setContextMenu(null);
  };

  // Clear reachability visualization
  const handleClearReach = () => {
    setReachabilityConfig(null);
    setContextMenu(null);
  };

  const performanceEvents = activeLayout?.performance?.events ?? [];
  const totalEvents = performanceEvents.length;

  if (!activeSection) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        No active section configured for this step.
      </div>
    );
  }

  // Helper to find relevant debug event for a pad at the current step
  const getDebugEventForPad = (row: number, col: number): EngineDebugEvent | null => {
    if (!engineResult || !activeLayout) return null;

    // If we have activeMapping, find the note by looking up the cell's SoundAsset
    // Otherwise, use the standard position-to-note conversion
    let noteNumber: number | null = null;
    if (activeMapping) {
      // Inline cellKey to avoid potential circular dependency issues
      const key = `${row},${col}`;
      const sound = activeMapping.cells[key];
      if (sound && sound.originalMidiNote !== null) {
        noteNumber = sound.originalMidiNote;
      }
    } else {
      noteNumber = activeSection ? GridMapService.getNoteForPosition(row, col, activeSection.instrumentConfig) : null;
    }
    
    if (noteNumber === null) return null;
    
    // Filter events for this specific note
    const noteEvents = engineResult.debugEvents.filter(e => e.noteNumber === noteNumber);
    
    if (noteEvents.length === 0) return null;

    if (viewAllSteps) {
      // Find the worst difficulty across all occurrences
      return noteEvents.reduce((worst, current) => {
        if (DIFFICULTY_RANK[current.difficulty] > DIFFICULTY_RANK[worst.difficulty]) {
          return current;
        }
        return worst;
      }, noteEvents[0]);
    } else {
      // Find event matching current step time
      // Calculate step duration: 16th notes = 1/4 of a beat
      const tempo = activeLayout.performance.tempo || 120; // Default to 120 BPM
      const beatDuration = 60 / tempo; // seconds per beat
      const stepDuration = beatDuration / 4; // 16th note duration
      
      // Calculate time window for current step
      const stepStartTime = currentStep * stepDuration;
      const stepEndTime = (currentStep + 1) * stepDuration;
      
      // Find events that fall within this time window
      const eventsInStep = noteEvents.filter(e => 
        e.startTime >= stepStartTime && e.startTime < stepEndTime
      );
      
      if (eventsInStep.length > 0) {
        // Return the first event in this step (or worst case if multiple)
        return eventsInStep.reduce((worst, current) => {
          if (DIFFICULTY_RANK[current.difficulty] > DIFFICULTY_RANK[worst.difficulty]) {
            return current;
          }
          return worst;
        }, eventsInStep[0]);
      }
      
      // Fallback: If no event in this exact step, return the worst case for this note
      // (This handles quantization mismatches)
      return noteEvents.reduce((worst, current) => {
        if (DIFFICULTY_RANK[current.difficulty] > DIFFICULTY_RANK[worst.difficulty]) {
          return current;
        }
        return worst;
      }, noteEvents[0]);
    }
  };

  // Determine bank number for a given row
  const getBankNumber = (row: number): number => {
    if (row <= 1) return 1; // Rows 0-1 = Bank 1
    if (row <= 3) return 2; // Rows 2-3 = Bank 2
    if (row <= 5) return 3; // Rows 4-5 = Bank 3
    return 4; // Rows 6-7 = Bank 4
  };

  return (
    <div className="flex items-center justify-center p-8 relative" ref={gridContainerRef}>
      <div 
        className="grid grid-cols-8 gap-2 bg-slate-900 p-4 rounded-xl shadow-2xl border border-slate-800 relative"
        style={{ width: 'fit-content' }}
      >
        {rows.map((row) => (
          <React.Fragment key={`row-${row}`}>
            {cols.map((col) => {
              // Get SoundAsset from activeMapping if available
              // Inline cellKey to avoid potential circular dependency issues
              const cellKeyStr = `${row},${col}`;
              const soundAsset = activeMapping?.cells[cellKeyStr] || null;
              
              // Determine note number - use SoundAsset's originalMidiNote if available, otherwise use position
              const noteNumber = soundAsset && soundAsset.originalMidiNote !== null
                ? soundAsset.originalMidiNote
                : GridMapService.getNoteForPosition(row, col, activeSection?.instrumentConfig);

              // Base per-step activation
              let isActive = gridPattern?.steps[currentStep]?.[row]?.[col] ?? false;
              let padOrderIndex: number | null = null;

              // When viewAllSteps is enabled, a pad is active if ANY event in the
              // performance maps to this pad (time is ignored). We also capture the
              // earliest event index for gradient shading.
              if (viewAllSteps && totalEvents > 0) {
                for (let i = 0; i < totalEvents; i += 1) {
                  const event = performanceEvents[i];
                  // Use activeMapping if available, otherwise fall back to InstrumentConfig
                  const pos = activeMapping
                    ? getPositionForMidi(event.noteNumber, activeMapping)
                    : activeSection
                      ? GridMapService.getPositionForNote(event.noteNumber, activeSection.instrumentConfig)
                      : null;
                  if (pos !== null && pos.row === row && pos.col === col) {
                    padOrderIndex = i;
                    break;
                  }
                }
                isActive = padOrderIndex !== null;
              }

              // Display name: use SoundAsset name if available, otherwise note name
              const displayName = soundAsset
                ? soundAsset.name
                : getNoteName(noteNumber);
              const debugEvent = isActive ? getDebugEventForPad(row, col) : null;

              // Get reachability level for this cell
              const cellKey = `${row},${col}`;
              const reachabilityLevel: ReachabilityLevel | null = reachabilityMap?.[cellKey] || null;
              
              // Check if this cell is highlighted
              const isHighlighted = highlightedCell?.row === row && highlightedCell?.col === col;

              // Compute styling based on difficulty and hand assignment
              let difficultyStyle = '';
              let dynamicStyle: React.CSSProperties | undefined;
              let handBorderColor: string | undefined; // For finger visualization border
              
              if (isActive) {
                // Determine hand-based border color for finger visualization
                if (debugEvent && debugEvent.finger && debugEvent.assignedHand !== 'Unplayable') {
                  const hand = debugEvent.assignedHand === 'LH' || debugEvent.assignedHand === 'left' ? 'left' : 'right';
                  handBorderColor = hand === 'left' ? '#3b82f6' : '#f97316'; // Blue for Left, Orange for Right
                }
                
                if (debugEvent) {
                  switch (debugEvent.difficulty) {
                    case 'Unplayable':
                      difficultyStyle = 'bg-red-900/80 border-red-500 border-4 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)]';
                      break;
                    case 'Hard':
                      difficultyStyle = 'bg-orange-900/80 border-orange-500 border-4 text-white shadow-[0_0_15px_rgba(249,115,22,0.6)]';
                      break;
                    case 'Medium':
                      difficultyStyle = 'bg-yellow-900/60 border-yellow-500 border-2 text-white shadow-[0_0_10px_rgba(234,179,8,0.4)]';
                      break;
                    case 'Easy':
                    default:
                      // Use hand-based border color if available, otherwise default blue
                      if (handBorderColor) {
                        difficultyStyle = `bg-blue-500 border-4 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]`;
                      } else {
                        difficultyStyle = 'bg-blue-500 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]';
                      }
                      break;
                  }
                } else {
                  // Default active style if no debug info (e.g. newly added note not yet processed)
                  difficultyStyle = 'bg-blue-500 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]';
                }
              } else {
                // Base inactive style
                difficultyStyle = 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700 hover:border-slate-600 hover:text-slate-300';
                
                // Apply reachability overlay if active
                if (reachabilityLevel) {
                  switch (reachabilityLevel) {
                    case 'green':
                      dynamicStyle = {
                        backgroundColor: 'rgba(34, 197, 94, 0.25)',
                        borderColor: 'rgba(34, 197, 94, 0.5)',
                      };
                      break;
                    case 'yellow':
                      dynamicStyle = {
                        backgroundColor: 'rgba(234, 179, 8, 0.25)',
                        borderColor: 'rgba(234, 179, 8, 0.5)',
                      };
                      break;
                    case 'gray':
                      difficultyStyle = 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700 hover:border-slate-600 hover:text-slate-300 opacity-50';
                      dynamicStyle = {
                        backgroundColor: 'rgba(107, 114, 128, 0.3)',
                        borderColor: 'rgba(107, 114, 128, 0.4)',
                      };
                      break;
                  }
                }
              }

              // Override with gradient if viewAllSteps is on AND it's not a high difficulty note
              // We want to preserve the red/orange warnings even in viewAllSteps mode
              if (viewAllSteps && padOrderIndex !== null && totalEvents > 1 && (!debugEvent || debugEvent.difficulty === 'Easy')) {
                const t = padOrderIndex / (totalEvents - 1); // 0..1
                const hue = 210 - t * 80; // blue-ish to green-ish
                const lightness = 45 + t * 10; // slightly brighter over time
                dynamicStyle = {
                  backgroundColor: `hsl(${hue}, 80%, ${lightness}%)`,
                };
              }

              // Tooltip content
              const noteName = getNoteName(noteNumber);
              let tooltip = `Note: ${noteNumber} (${noteName}) | Row: ${row}, Col: ${col}`;
              if (debugEvent && debugEvent.difficulty !== 'Easy') {
                tooltip += `\nDifficulty: ${debugEvent.difficulty}`;
                tooltip += `\nCost: ${debugEvent.cost.toFixed(2)}`;
                tooltip += `\nHand: ${debugEvent.assignedHand}`;
                if (debugEvent.finger && debugEvent.assignedHand !== 'Unplayable') {
                  const hand = normalizeHand(debugEvent.assignedHand);
                  tooltip += `\nFinger: ${formatFinger(hand, debugEvent.finger)}`;
                }
              }

              // Handle cell click - only allow in non-readOnly mode
              const handleCellClick = () => {
                if (readOnly) return; // Disable clicks in readOnly mode
                // Call the standard toggle handler
                onTogglePad(currentStep, row, col);
                // Also call the optional cell click handler for selection
                if (onCellClick) {
                  onCellClick(row, col);
                }
              };

              // Apply SoundAsset color if available
              const cellColor = soundAsset
                ? soundAsset.color
                : undefined;

              return (
                <div
                  key={`pad-${row}-${col}`}
                  className={`
                    w-16 h-16 flex flex-col items-center justify-center rounded-md transition-all duration-100 relative border
                    ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                    ${difficultyStyle}
                    ${isActive ? 'scale-95' : ''}
                    ${isHighlighted ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-slate-900 z-20' : ''}
                  `}
                  style={{
                    ...dynamicStyle,
                    borderLeftWidth: soundAsset ? '4px' : undefined,
                    borderLeftColor: cellColor || undefined,
                    // Apply hand-based border color for finger visualization (overrides difficulty border for Easy)
                    ...(isActive && handBorderColor && (!debugEvent || debugEvent.difficulty === 'Easy') 
                      ? { borderColor: handBorderColor, borderWidth: '4px' }
                      : {}),
                  }}
                  onClick={handleCellClick}
                  onContextMenu={readOnly ? undefined : (e) => handleContextMenu(e, row, col)}
                  title={tooltip}
                >
                  <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {displayName}
                  </span>
                  
                  {/* W4: Per-Pad Note Count */}
                  {padNoteCounts[cellKeyStr] !== undefined && padNoteCounts[cellKeyStr] > 0 && (
                    <div className="absolute bottom-1 left-1 bg-slate-900/80 text-slate-300 text-[10px] font-mono px-1 py-0.5 rounded border border-slate-700">
                      {padNoteCounts[cellKeyStr]}
                    </div>
                  )}
                  
                  {/* Finger Visualization Badge - Show finger assignment for active pads */}
                  {isActive && (
                    debugEvent && debugEvent.finger && debugEvent.assignedHand !== 'Unplayable' ? (
                      <div className={`
                        absolute top-1 right-1 px-1.5 py-0.5 rounded flex items-center justify-center text-[9px] font-bold shadow-sm z-10 border-2
                        ${debugEvent.assignedHand === 'LH' || debugEvent.assignedHand === 'left' 
                          ? 'bg-blue-500/90 text-white border-blue-300' 
                          : 'bg-orange-500/90 text-white border-orange-300'}
                      `}>
                        {normalizeHand(debugEvent.assignedHand as 'LH' | 'RH')}-{getFingerAbbreviation(debugEvent.finger)}
                      </div>
                    ) : (
                      // Show '?' if pad is active but no analysis data available
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-600/80 text-slate-200 border-2 border-slate-500 shadow-sm z-10">
                        ?
                      </div>
                    )
                  )}

                  {showDebugLabels && (
                    <div className="absolute bottom-1 left-0 right-0 flex flex-col items-center text-[9px] opacity-60 leading-tight pointer-events-none font-mono">
                      <span>{noteNumber}</span>
                      <span>[{row},{col}]</span>
                      {debugEvent && (
                        <span className={
                          debugEvent.difficulty === 'Unplayable' ? 'text-red-200 font-bold' :
                          debugEvent.difficulty === 'Hard' ? 'text-orange-200 font-bold' : ''
                        }>
                          {debugEvent.assignedHand}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Bank divider after rows 1, 3, and 5 */}
            {showBankGuides && (row === 1 || row === 3 || row === 5) && (
              <div
                key={`divider-${row}`}
                className="col-span-8 flex items-center gap-2 my-1"
              >
                <div className="flex-1 h-px bg-slate-600/50"></div>
                <span className="text-xs font-medium text-slate-500 px-2">
                  Bank {getBankNumber(row + 1)}
                </span>
                <div className="flex-1 h-px bg-slate-600/50"></div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-slate-800 border border-slate-700 rounded-md shadow-xl z-50 min-w-[180px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div className="py-1">
            <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-700">
              Show Reach from [{contextMenu.row},{contextMenu.col}]
            </div>
            
            {/* Left Hand Options */}
            <div className="px-2 py-1">
              <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">Left Hand</div>
              {[1, 2, 3, 4, 5].map((finger) => (
                <button
                  key={`L${finger}`}
                  onClick={() => handleShowReach('L', finger as FingerID)}
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 rounded"
                >
                  L{finger} - {finger === 1 ? 'Thumb' : finger === 2 ? 'Index' : finger === 3 ? 'Middle' : finger === 4 ? 'Ring' : 'Pinky'}
                </button>
              ))}
            </div>

            {/* Right Hand Options */}
            <div className="px-2 py-1">
              <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">Right Hand</div>
              {[1, 2, 3, 4, 5].map((finger) => (
                <button
                  key={`R${finger}`}
                  onClick={() => handleShowReach('R', finger as FingerID)}
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 rounded"
                >
                  R{finger} - {finger === 1 ? 'Thumb' : finger === 2 ? 'Index' : finger === 3 ? 'Middle' : finger === 4 ? 'Ring' : 'Pinky'}
                </button>
              ))}
            </div>

            {/* Clear Option */}
            {reachabilityConfig && (
              <>
                <div className="border-t border-slate-700 my-1" />
                <button
                  onClick={handleClearReach}
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-700 rounded"
                >
                  Clear Reachability
                </button>
              </>
            )}

            {/* Finger Constraint Assignment (only if onUpdateFingerConstraint is provided) */}
            {onUpdateFingerConstraint && activeMapping && (
              <>
                <div className="border-t border-slate-700 my-1" />
                <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-700">
                  Assign Finger Constraint
                </div>
                
                {/* Left Hand Finger Constraints */}
                <div className="px-2 py-1">
                  <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">Left Hand</div>
                  {[1, 2, 3, 4, 5].map((finger) => {
                    const cellKey = `${contextMenu.row},${contextMenu.col}`;
                    const currentConstraint = activeMapping.fingerConstraints[cellKey];
                    const constraintValue = `L${finger}`;
                    const isActive = currentConstraint === constraintValue;
                    return (
                      <button
                        key={`assign-L${finger}`}
                        onClick={() => {
                          onUpdateFingerConstraint(cellKey, isActive ? null : constraintValue);
                          setContextMenu(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-sm rounded ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {isActive ? '✓ ' : ''}L{finger} - {finger === 1 ? 'Thumb' : finger === 2 ? 'Index' : finger === 3 ? 'Middle' : finger === 4 ? 'Ring' : 'Pinky'}
                      </button>
                    );
                  })}
                </div>

                {/* Right Hand Finger Constraints */}
                <div className="px-2 py-1">
                  <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">Right Hand</div>
                  {[1, 2, 3, 4, 5].map((finger) => {
                    const cellKey = `${contextMenu.row},${contextMenu.col}`;
                    const currentConstraint = activeMapping.fingerConstraints[cellKey];
                    const constraintValue = `R${finger}`;
                    const isActive = currentConstraint === constraintValue;
                    return (
                      <button
                        key={`assign-R${finger}`}
                        onClick={() => {
                          onUpdateFingerConstraint(cellKey, isActive ? null : constraintValue);
                          setContextMenu(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-sm rounded ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {isActive ? '✓ ' : ''}R{finger} - {finger === 1 ? 'Thumb' : finger === 2 ? 'Index' : finger === 3 ? 'Middle' : finger === 4 ? 'Ring' : 'Pinky'}
                      </button>
                    );
                  })}
                </div>

                {/* Clear Finger Constraint */}
                {activeMapping.fingerConstraints[`${contextMenu.row},${contextMenu.col}`] && (
                  <>
                    <div className="border-t border-slate-700 my-1" />
                    <button
                      onClick={() => {
                        onUpdateFingerConstraint(`${contextMenu.row},${contextMenu.col}`, null);
                        setContextMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-slate-700 rounded"
                    >
                      Clear Finger Constraint
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Reachability Info Badge */}
      {reachabilityConfig && (
        <div className="absolute top-4 right-4 bg-slate-800/90 border border-slate-700 rounded-md p-3 shadow-lg z-40">
          <div className="text-sm font-semibold text-slate-200 mb-2">
            Reachability: {reachabilityConfig.hand}{reachabilityConfig.anchorFinger}
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-600/60 border border-green-500"></div>
              <span>Easy (≤3.0)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-600/60 border border-yellow-500"></div>
              <span>Medium (3.0-5.0)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-600/60 border border-gray-500"></div>
              <span>Unreachable (&gt;5.0)</span>
            </div>
          </div>
          <button
            onClick={handleClearReach}
            className="mt-2 w-full px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};
