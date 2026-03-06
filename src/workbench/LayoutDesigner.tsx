import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { Voice, GridMapping, cellKey, parseCellKey } from '../types/layout';
import { getReachabilityMap, ReachabilityLevel } from '../engine/feasibility';
import { GridPosition } from '../engine/gridMath';
import { FingerID } from '../types/engine';
import { FingerType } from '../engine/models';
// MIDI import logic removed - handled by parent Workbench component

/**
 * Converts FingerType string to FingerID number for CSS variable lookup.
 * Maps: thumb=1, index=2, middle=3, ring=4, pinky=5
 */
const fingerTypeToId = (fingerType: FingerType | null): FingerID | null => {
  if (!fingerType) return null;
  const mapping: Record<FingerType, FingerID> = {
    'thumb': 1,
    'index': 2,
    'middle': 3,
    'ring': 4,
    'pinky': 5,
  };
  return mapping[fingerType] ?? null;
};
import { InstrumentConfig } from '../types/performance';
import { GridMapService } from '../engine/gridMapService';
import { ProjectState, LayoutSnapshot } from '../types/projectState';
import { EngineResult } from '../engine/core';
import { VoiceLibrary } from './VoiceLibrary';
import { FingerLegend } from './FingerLegend';
import { NaturalHandPosePanel, getPoseGhostMarkers, handlePoseEditPadClick } from './NaturalHandPosePanel';
import { FingerId, NaturalHandPose, createDefaultPose0 } from '../types/naturalHandPose';

import { getActivePerformance } from '../utils/performanceSelectors';

/**
 * LayoutDesigner Component
 * 
 * TERMINOLOGY (see TERMINOLOGY.md):
 * - Voice: A unique MIDI pitch (e.g., MIDI Note 36)
 * - Cell: A slot in the 128 Drum Rack (Index 0-127)
 * - Pad: A specific x/y coordinate on the 8x8 grid
 * - Assignment: The mapping of a Voice/Cell to a Pad
 */
interface LayoutDesignerProps {
  /** Staging area for Voices before Assignment to Pads (legacy name: parkedSounds) */
  parkedSounds: Voice[];
  /** Currently active mapping being edited (defines Pad-to-Voice Assignments) */
  activeMapping: GridMapping | null;
  /** Instrument configuration for MIDI import (defines Voice-to-Pad Assignment mapping) */
  instrumentConfig: InstrumentConfig | null;
  /** Callback when a Voice is assigned to a Pad (Assignment relationship) */
  onAssignSound: (cellKey: string, sound: Voice) => void;
  // /** Callback to assign multiple Voices to Pads at once (batch Assignment operations) */
  // onAssignSounds: (assignments: Record<string, Voice>) => void;
  /** Callback when mapping metadata is updated */
  onUpdateMapping: (updates: Partial<GridMapping>) => void;
  // /** Callback to duplicate the current mapping */
  // onDuplicateMapping: () => void;
  /** Callback to add a new Voice to parkedSounds (staging area) */
  onAddSound: (sound: Voice) => void;
  /** Callback to update a Voice in parkedSounds (staging area) */
  onUpdateSound: (soundId: string, updates: Partial<Voice>) => void;
  /** Callback to update a Voice in the active mapping (Pad Assignment) */
  onUpdateMappingSound: (cellKey: string, updates: Partial<Voice>) => void;
  /** Callback to remove a Voice Assignment from a Pad */
  onRemoveSound: (cellKey: string) => void;
  /** Callback to delete a Voice from parkedSounds (staging area) */
  onDeleteSound?: (soundId: string) => void;
  /** Current project state (for save/load operations) */
  projectState: ProjectState;
  /** Callback to update the entire project state */
  onUpdateProjectState: (state: ProjectState) => void;
  // /** Callback to set the active mapping ID */
  // onSetActiveMappingId?: (id: string) => void;
  /** Active layout for performance analysis */
  activeLayout: LayoutSnapshot | null;

  /** View Settings: Show Cell labels (Voice MIDI note numbers) on Pads */
  showNoteLabels?: boolean;
  /** View Settings: Show position labels (row, col) on Pads */
  showPositionLabels?: boolean;
  /** View Settings: View all steps (flatten time) */
  viewAllSteps?: boolean;
  // /** View Settings: Show heatmap overlay */
  // showHeatmap?: boolean;
  /** Engine result from Workbench (reactive solver loop) */
  engineResult?: EngineResult | null;

  // Explicit Layout Control Callbacks (new for user-driven layout model)
  // ============================================================================
  // /** Callback to run biomechanical optimization on the current layout */
  // onOptimizeLayout?: () => void;
  // /** Callback to save the current layout as a new version */
  // onSaveLayoutVersion?: () => void;
  // /** Callback to trigger map to quadrants (exposed for Workbench settings menu) */
  // onRequestMapToQuadrants?: () => void;
}

// Droppable Pad Component (represents a Pad on the 8x8 grid)
interface DroppableCellProps {
  row: number;
  col: number;
  assignedSound: Voice | null;
  isOver: boolean;
  isSelected: boolean;
  isHighlighted?: boolean;
  templateSlot: { label: string; suggestedNote?: number } | null;
  reachabilityLevel: ReachabilityLevel | null;
  heatmapDifficulty?: 'Easy' | 'Medium' | 'Hard' | 'Unplayable' | null;
  heatmapFinger?: FingerID | null;
  heatmapHand?: 'LH' | 'RH' | null;
  fingerConstraint?: string | null;
  showNoteLabels?: boolean;
  showPositionLabels?: boolean;
  instrumentConfig?: InstrumentConfig | null;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  /** Ghost marker for Natural Hand Pose visualization */
  poseGhostMarker?: { shortName: string; color: string; isOffGrid: boolean } | null;
  /** Whether pose edit mode is active */
  isPoseEditMode?: boolean;
}

const DroppableCell: React.FC<DroppableCellProps & { onUpdateSound?: (updates: Partial<Voice>) => void }> = ({
  row,
  col,
  assignedSound,
  isOver,
  isSelected,
  isHighlighted = false,
  templateSlot,
  // reachabilityLevel,
  heatmapDifficulty,
  heatmapFinger,
  heatmapHand,
  fingerConstraint,
  showNoteLabels = false,
  showPositionLabels = false,
  instrumentConfig = null,
  onClick,
  onDoubleClick,
  onContextMenu,
  onUpdateSound,
  poseGhostMarker,
  isPoseEditMode = false,
}) => {
  // Get Cell (MIDI note number) for label display on this Pad
  const noteNumber = assignedSound && assignedSound.originalMidiNote !== null
    ? assignedSound.originalMidiNote
    : instrumentConfig
      ? GridMapService.getNoteForPosition(row, col, instrumentConfig)
      : null;

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const getNoteName = (midiNote: number): string => {
    const note = NOTE_NAMES[midiNote % 12];
    const octave = Math.floor(midiNote / 12) - 2;
    return `${note}${octave}`;
  };
  const key = cellKey(row, col);
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: key,
  });

  // Make assigned sound draggable
  const dragId = assignedSound ? `cell-${key}` : `empty-${key}`;
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: dragId,
    disabled: !assignedSound,
  });

  const dragStyle = transform
    ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      zIndex: 50,
    }
    : undefined;

  // Combine refs for both droppable and draggable
  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    if (assignedSound && node) {
      setDragRef(node);
    }
  };

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(assignedSound?.name || '');
  const inputRef = useRef<HTMLInputElement>(null);

  // Update edit name when sound changes
  useEffect(() => {
    if (assignedSound) {
      setEditName(assignedSound.name);
    }
  }, [assignedSound]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (assignedSound && onUpdateSound && editName.trim() !== '') {
      onUpdateSound({ name: editName });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditName(assignedSound?.name || '');
      setIsEditing(false);
    }
    e.stopPropagation(); // Prevent triggering other shortcuts
  };

  // Dynamic Styles based on state
  const getBackgroundStyle = () => {
    if (assignedSound) {
      // PRIORITY 1: Use finger colors when we have finger assignment data (matches the legend)
      // This includes manual assignments, which take priority over engine results
      if (heatmapFinger && heatmapHand) {
        // Use the finger colors from the thermal legend
        const fingerVar = `var(--finger-${heatmapHand === 'LH' ? 'L' : 'R'}${heatmapFinger})`;
        const fingerVarDark = `var(--finger-${heatmapHand === 'LH' ? 'L' : 'R'}${Math.max(1, heatmapFinger - 1)})`;
        return `linear-gradient(135deg, ${fingerVar} 0%, ${fingerVarDark} 100%)`;
      }

      // PRIORITY 2: Fallback to difficulty colors ONLY if we have difficulty but no finger assignment
      // This handles cases where the engine couldn't assign a finger (e.g., truly unplayable)
      if (heatmapDifficulty) {
        switch (heatmapDifficulty) {
          case 'Unplayable': return 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)'; // Red (unplayable)
          case 'Hard': return 'linear-gradient(135deg, #f97316 0%, #9a3412 100%)'; // Orange
          case 'Medium': return 'linear-gradient(135deg, #eab308 0%, #854d0e 100%)'; // Yellow
          default: return 'linear-gradient(135deg, var(--finger-L1) 0%, var(--finger-L2) 100%)'; // Blue (Easy)
        }
      }

      // PRIORITY 3: Default: neutral color for cells without engine data yet
      return 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-panel) 100%)';
    }

    // Empty Cell State
    if (isDroppableOver || isOver) return 'rgba(var(--finger-L1-rgb), 0.2)'; // Blue tint on hover
    return 'var(--bg-panel)'; // Default panel bg
  };

  // Determine finger color for border/glow
  const getFingerColor = () => {
    if (fingerConstraint) {
      return `var(--finger-${fingerConstraint})`;
    }
    if (heatmapFinger && heatmapHand) {
      return `var(--finger-${heatmapHand === 'LH' ? 'L' : 'R'}${heatmapFinger})`;
    }
    return null;
  };

  const fingerColor = getFingerColor();

  // Helper to darken color for gradient
  // const adjustColorBrightness = (hex: string, _percent: number) => {
  //   // Simple placeholder - in real app use a proper color lib
  //   return hex;
  // }

  return (
    <div
      ref={combinedRef}
      onClick={(e) => {
        if (!isDragging && !isEditing) {
          e.stopPropagation();
          onClick();
        }
      }}
      onDoubleClick={(e) => {
        if (assignedSound) {
          e.stopPropagation();
          setIsEditing(true);
        } else {
          onDoubleClick();
        }
      }}
      onContextMenu={onContextMenu}
      {...(assignedSound && !isDragging && !isEditing ? listeners : {})}
      {...(assignedSound && !isDragging && !isEditing ? attributes : {})}
      className={`
        w-full aspect-square rounded-xl flex flex-col items-center justify-center
        transition-all duration-200 relative select-none
        ${isHighlighted ? 'ring-2 ring-[var(--finger-R4)] shadow-[0_0_15px_rgba(250,204,21,0.5)] z-20' : ''}
        ${assignedSound
          ? isSelected || isEditing
            ? 'ring-2 ring-[var(--text-primary)] shadow-lg scale-[1.02] z-10'
            : isDragging
              ? 'opacity-50 scale-95 cursor-grabbing'
              : 'shadow-md hover:shadow-lg hover:scale-[1.02] cursor-grab active:cursor-grabbing'
          : isDroppableOver || isOver
            ? 'border-2 border-dashed border-[var(--finger-L1)] scale-95'
            : 'border border-[var(--border-subtle)] hover:bg-[var(--bg-card)]'
        }
      `}
      style={{
        ...dragStyle,
        background: getBackgroundStyle(),
        boxShadow: assignedSound && !isDragging
          ? fingerColor
            ? `inset 0 0 0 2px ${fingerColor}, 0 4px 6px -1px rgba(0,0,0,0.3)`
            : 'inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 6px -1px rgba(0,0,0,0.3)'
          : undefined,
        borderColor: fingerColor || undefined,
      }}
    >
      {assignedSound ? (
        <>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="w-[90%] px-1 py-0.5 text-[10px] bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--finger-L1)] rounded text-center focus:outline-none focus:ring-1 focus:ring-[var(--finger-L1)]"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            /* Sound Name */
            <span className="text-[10px] font-bold text-[var(--text-primary)] tracking-wide uppercase truncate max-w-[90%] drop-shadow-md">
              {assignedSound.name}
            </span>
          )}

          {/* Note Info - Show when showNoteLabels is enabled */}
          {showNoteLabels && noteNumber !== null && (
            <span className="text-[9px] text-[var(--text-primary)] opacity-60 mt-0.5 font-mono">
              {getNoteName(noteNumber)}
            </span>
          )}

          {/* Position Label - Show when showPositionLabels is enabled */}
          {showPositionLabels && (
            <span className="text-[8px] text-[var(--text-primary)] opacity-50 mt-0.5 font-mono">
              {row},{col}
            </span>
          )}

          {/* Finger Badge (Top Right) - Uses finger colors from legend */}
          {heatmapFinger && heatmapHand && (
            <div
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-md z-10 border-2 border-white/30"
              style={{
                backgroundColor: `var(--finger-${heatmapHand === 'LH' ? 'L' : 'R'}${heatmapFinger})`,
                color: 'white',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              {heatmapHand === 'LH' ? 'L' : 'R'}{heatmapFinger}
            </div>
          )}

          {/* Finger Constraint Lock (Top Left) */}
          {fingerConstraint && (
            <div className="absolute -top-1 -left-1 bg-[var(--bg-card)] rounded-full p-0.5 border border-[var(--border-subtle)]">
              <span className="text-[8px]">🔒</span>
            </div>
          )}

          {/* Pose Ghost Marker (Bottom Left) - Show when pose has this pad assigned */}
          {poseGhostMarker && (
            <div
              className={`absolute -bottom-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-md z-10 border-2 border-white/30 ${
                poseGhostMarker.isOffGrid ? 'opacity-40' : ''
              }`}
              style={{
                backgroundColor: poseGhostMarker.color,
                color: 'white',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}
              title={`Natural Pose: ${poseGhostMarker.shortName}${poseGhostMarker.isOffGrid ? ' (off-grid)' : ''}`}
            >
              {poseGhostMarker.shortName}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Empty State Content */}
          {templateSlot ? (
            <div className="flex flex-col items-center opacity-40">
              <span className="text-[9px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                {templateSlot.label}
              </span>
              {/* Show Note ID for template slots when showNoteLabels is enabled */}
              {showNoteLabels && noteNumber !== null && (
                <span className="text-[9px] text-[var(--text-secondary)] opacity-60 mt-0.5 font-mono">
                  {getNoteName(noteNumber)}
                </span>
              )}
              {/* Show Position Label for template slots when showPositionLabels is enabled */}
              {showPositionLabels && (
                <span className="text-[8px] text-[var(--text-secondary)] opacity-50 mt-0.5 font-mono">
                  {row},{col}
                </span>
              )}
            </div>
          ) : (
            <>
              {/* Show Note ID or Position Label for empty cells */}
              {showNoteLabels && noteNumber !== null ? (
                <span className="text-[9px] text-[var(--text-secondary)] font-mono opacity-70">
                  {getNoteName(noteNumber)}
                </span>
              ) : showPositionLabels ? (
                <span className="text-[8px] text-[var(--text-secondary)] font-mono opacity-70">
                  {row},{col}
                </span>
              ) : (
                // Subtle coordinate for empty cells (only when both labels are off)
                <span className="text-[8px] text-[var(--text-secondary)] font-mono opacity-0 hover:opacity-100 transition-opacity">
                  {row},{col}
                </span>
              )}

              {/* Pose Ghost Marker for empty cells */}
              {poseGhostMarker && (
                <div
                  className={`absolute inset-2 rounded-lg flex items-center justify-center ${
                    poseGhostMarker.isOffGrid ? 'opacity-40' : 'opacity-70'
                  } ${isPoseEditMode ? 'ring-2 ring-dashed ring-white/50' : ''}`}
                  style={{
                    backgroundColor: poseGhostMarker.color,
                  }}
                  title={`Natural Pose: ${poseGhostMarker.shortName}${poseGhostMarker.isOffGrid ? ' (off-grid)' : ''}`}
                >
                  <span className="text-[11px] font-bold text-white drop-shadow-md">
                    {poseGhostMarker.shortName}
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export const LayoutDesigner: React.FC<LayoutDesignerProps> = ({
  parkedSounds,
  activeMapping,
  instrumentConfig,
  onAssignSound,
  // onAssignSounds,
  onUpdateMapping,
  // onDuplicateMapping,
  onAddSound,
  onUpdateSound,
  onUpdateMappingSound,
  onRemoveSound,
  onDeleteSound,
  projectState,
  onUpdateProjectState,
  // onSetActiveMappingId,
  activeLayout,

  showNoteLabels = false,
  showPositionLabels = false,
  // viewAllSteps = false,
  // showHeatmap = false,
  engineResult: engineResultProp = null,

  // Explicit layout control callbacks
  // onOptimizeLayout,
  // onSaveLayoutVersion,
  // onRequestMapToQuadrants,
}) => {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedSound, setDraggedSound] = useState<Voice | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  // View Settings are now passed as props from Workbench
  // Keep local state for backward compatibility if needed, but use props
  // const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  // const [timelineForceVisible, setTimelineForceVisible] = useState(false);
  // Engine result is now passed from Workbench (reactive solver loop)
  // Use prop if provided, otherwise fall back to null
  const engineResult = engineResultProp;

  // Build a lookup map from noteNumber -> finger assignment for efficient cell coloring
  // This is computed once when engineResult changes, then used for all cells
  // Uses the LAST occurrence of each note, so manual assignment changes are reflected
  const fingerAssignmentMap = useMemo(() => {
    const map = new Map<number, { finger: FingerID | null; hand: 'LH' | 'RH' | null; difficulty: string }>();

    if (!engineResult) return map;

    // Get manual assignments for current layout (these take priority over engine results)
    const currentLayoutId = projectState.activeLayoutId;
    const manualAssignments = currentLayoutId && projectState.manualAssignments
      ? projectState.manualAssignments[currentLayoutId]
      : undefined;

    // Get filtered performance to map event indices to note numbers
    const filteredPerformance = getActivePerformance(projectState);

    // First, process manual assignments (they override engine results). Key by eventKey for stable identity.
    if (manualAssignments && filteredPerformance) {
      filteredPerformance.events.forEach((event, eventIndex) => {
        const key = event.eventKey ?? String(eventIndex);
        const manualAssignment = manualAssignments[key];

        if (manualAssignment) {
          // Manual assignment takes priority - use it even if engine says Unplayable
          map.set(event.noteNumber, {
            finger: fingerTypeToId(manualAssignment.finger),
            hand: manualAssignment.hand === 'left' ? 'LH' : 'RH',
            // Still get difficulty from engine if available, but use manual finger for color
            difficulty: engineResult.debugEvents[eventIndex]?.difficulty || 'Medium',
          });
        }
      });
    }

    // Then, process engine results for notes without manual assignments
    // For each note, store the LAST finger assignment (so manual changes show up)
    engineResult.debugEvents.forEach((event, eventIndex) => {
      // Skip if this event has a manual assignment (already processed above)
      if (manualAssignments && filteredPerformance) {
        const ev = filteredPerformance.events[eventIndex];
        const key = ev?.eventKey ?? String(eventIndex);
        if (manualAssignments[key]) {
          return; // Skip - manual assignment already handled
        }
      }

      // Only add if we have a valid finger assignment
      if (event.assignedHand !== 'Unplayable' && event.finger) {
        // Only set if not already set by manual assignment
        if (!map.has(event.noteNumber)) {
          map.set(event.noteNumber, {
            finger: fingerTypeToId(event.finger),
            hand: event.assignedHand === 'left' ? 'LH' : 'RH',
            difficulty: event.difficulty,
          });
        }
      }
    });

    return map;
  }, [engineResult, projectState]);

  // Left Panel Tab State
  const [leftPanelTab, setLeftPanelTab] = useState<'library' | 'pose'>('library');

  // Pose Editor State
  const [isPoseEditMode, setIsPoseEditMode] = useState(false);
  const [activeFinger, setActiveFinger] = useState<FingerId | null>(null);
  const [previewOffset, setPreviewOffset] = useState(0);

  // Get Pose 0 from project state (or create default)
  const pose0: NaturalHandPose = projectState.naturalHandPoses?.[0] ?? createDefaultPose0();

  // Update Pose 0 in project state
  const handleUpdatePose0 = useCallback((pose: NaturalHandPose) => {
    const newPoses = [...(projectState.naturalHandPoses ?? [createDefaultPose0()])];
    newPoses[0] = pose;
    onUpdateProjectState({
      ...projectState,
      naturalHandPoses: newPoses,
    });
  }, [projectState, onUpdateProjectState]);

  // Toggle pose edit mode
  const handleTogglePoseEditMode = useCallback(() => {
    setIsPoseEditMode(prev => !prev);
    if (isPoseEditMode) {
      setActiveFinger(null); // Clear active finger when exiting edit mode
    }
  }, [isPoseEditMode]);

  // Get ghost markers for pose visualization
  const poseGhostMarkers = useMemo(() => {
    return getPoseGhostMarkers(pose0, previewOffset);
  }, [pose0, previewOffset]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetCell: string;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Reachability visualization state
  // Track by cell key so we can update when the cell moves
  const [reachabilityConfig, setReachabilityConfig] = useState<{
    anchorCellKey: string;
    anchorPos: GridPosition;
    anchorFinger: FingerID;
    targetFinger: FingerID;
    hand: 'L' | 'R';
  } | null>(null);

  // Configure sensors with activation constraints to allow clicks
  // Only activate drag after 5px movement or 200ms delay
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Generate 8x8 grid (rows 0-7, cols 0-7)
  // Visual: Row 7 is top, Row 0 is bottom
  const rows = Array.from({ length: 8 }, (_, i) => 7 - i);
  const cols = Array.from({ length: 8 }, (_, i) => i);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    const activeIdStr = active.id as string;

    // Check if dragging from a cell
    if (activeIdStr.startsWith('cell-')) {
      const cellKey = activeIdStr.replace('cell-', '');
      if (activeMapping) {
        const sound = activeMapping.cells[cellKey];
        if (sound) {
          setDraggedSound(sound);
        }
      }
    } else {
      // Dragging from library
      const sound = parkedSounds.find(s => s.id === active.id);
      if (sound) {
        setDraggedSound(sound);
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? (over.id as string) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      setDraggedSound(null);
      setOverId(null);
      return;
    }

    // Check if dragging from a cell (format: "cell-row,col")
    const activeIdStr = active.id as string;
    let sound: Voice | null = null;
    let sourceCellKey: string | null = null;

    if (activeIdStr.startsWith('cell-')) {
      // Dragging from a placed cell
      sourceCellKey = activeIdStr.replace('cell-', '');
      if (activeMapping && sourceCellKey) {
        sound = activeMapping.cells[sourceCellKey] || null;
      }
    } else {
      // Dragging from library
      sound = parkedSounds.find(s => s.id === active.id) || null;
    }

    if (!sound) {
      setActiveId(null);
      setDraggedSound(null);
      setOverId(null);
      return;
    }

    // Check if dropped on staging area (to unassign from grid)
    if (over.id === 'staging-area' && sourceCellKey) {
      // Remove from grid and add to parked sounds if not already there
      onRemoveSound(sourceCellKey);
      const isInParked = parkedSounds.some(s => s.id === sound.id);
      if (!isInParked) {
        onAddSound(sound);
      }
      setActiveId(null);
      setDraggedSound(null);
      setOverId(null);
      return;
    }

    // Check if dropped on a grid cell
    let targetCellKey = over.id as string;
    const parsed = parseCellKey(targetCellKey);

    // Valid grid cell drop
    if (parsed) {
      // Logic for valid grid cell drop continues below
    }

    // Update reachability config if the anchor cell is being moved
    if (sourceCellKey && reachabilityConfig && reachabilityConfig.anchorCellKey === sourceCellKey) {
      const newParsed = parseCellKey(targetCellKey);
      if (newParsed) {
        setReachabilityConfig({
          ...reachabilityConfig,
          anchorCellKey: targetCellKey,
          anchorPos: { row: newParsed.row, col: newParsed.col },
        });
      }
    }

    // Scenario A: Dragging from Library (New Placement)
    if (!sourceCellKey) {
      // Just assign the sound to the target cell
      onAssignSound(targetCellKey, sound);
    }
    // Scenario B: Dragging from Grid (Move)
    else if (sourceCellKey !== targetCellKey) {
      // Get current cells state
      if (!activeMapping) {
        // Create new mapping if none exists
        onAssignSound(targetCellKey, sound);
        return;
      }

      const currentCells = { ...activeMapping.cells };
      const targetSound = currentCells[targetCellKey] || null;
      const sourceSound = currentCells[sourceCellKey] || null;

      if (!sourceSound) {
        // Source cell doesn't have a sound (shouldn't happen, but handle gracefully)
        setActiveId(null);
        setDraggedSound(null);
        setOverId(null);
        return;
      }

      // Create new cells object for atomic update
      // Start fresh to prevent any duplicates
      const newCells: Record<string, Voice> = {};

      // Copy all cells except source and target (we'll handle those separately)
      Object.entries(currentCells).forEach(([key, value]) => {
        if (key !== sourceCellKey && key !== targetCellKey) {
          newCells[key] = value;
        }
      });

      // Handle swap if target already has a sound
      if (targetSound) {
        // Swap: Move target sound to source position
        newCells[sourceCellKey] = targetSound;
      }
      // If target is empty, sourceCellKey will remain empty (already excluded)

      // Assign dragged sound to target
      newCells[targetCellKey] = sourceSound;

      // Update finger constraints if they exist
      const newFingerConstraints = { ...activeMapping.fingerConstraints };

      // If source had a constraint, move it to target (or clear if swapping)
      if (newFingerConstraints[sourceCellKey]) {
        if (targetSound && newFingerConstraints[targetCellKey]) {
          // Both have constraints - swap them
          const sourceConstraint = newFingerConstraints[sourceCellKey];
          const targetConstraint = newFingerConstraints[targetCellKey];
          newFingerConstraints[targetCellKey] = sourceConstraint;
          newFingerConstraints[sourceCellKey] = targetConstraint;
        } else if (targetSound) {
          // Only source had constraint - move to target, clear source
          newFingerConstraints[targetCellKey] = newFingerConstraints[sourceCellKey];
          delete newFingerConstraints[sourceCellKey];
        } else {
          // Target is empty - move constraint to target
          newFingerConstraints[targetCellKey] = newFingerConstraints[sourceCellKey];
          delete newFingerConstraints[sourceCellKey];
        }
      } else if (targetSound && newFingerConstraints[targetCellKey]) {
        // Only target had constraint - move to source
        newFingerConstraints[sourceCellKey] = newFingerConstraints[targetCellKey];
        delete newFingerConstraints[targetCellKey];
      }

      // Atomic update: Update mapping with new cells and constraints in one operation
      onUpdateMapping({
        cells: newCells,
        fingerConstraints: newFingerConstraints,
      });
    }
    // If sourceCellKey === targetCellKey, do nothing (dropped on same cell)

    setActiveId(null);
    setDraggedSound(null);
    setOverId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setDraggedSound(null);
    setOverId(null);
  };

  // Get the sound assigned to a cell
  const getCellSound = (row: number, col: number): Voice | null => {
    if (!activeMapping) return null;
    const key = cellKey(row, col);
    return activeMapping.cells[key] || null;
  };



  // Handle MIDI file import - delegate to parent component (Workbench)
  // All MIDI parsing and state updates are handled by Workbench.handleProjectLoad




  // Handle clear staging area - remove all sounds from staging
  const handleClearStaging = () => {
    if (stagingAssets.length === 0) {
      return; // Nothing to clear
    }

    if (window.confirm(`Are you sure you want to remove all ${stagingAssets.length} sound(s) from staging? This will permanently delete them.`)) {
      // Delete all staging sounds
      stagingAssets.forEach(sound => {
        onDeleteSound?.(sound.id);
      });
    }
  };




  // Handle cell click - selects the sound asset at that coordinate OR assigns finger in pose edit mode
  const handleCellClick = (row: number, col: number) => {
    // Handle pose edit mode: assign active finger to this pad
    if (isPoseEditMode && leftPanelTab === 'pose') {
      const result = handlePoseEditPadClick(row, col, activeFinger, pose0, handleUpdatePose0);
      if (!result.success && result.message) {
        console.log('[LayoutDesigner] Pose edit:', result.message);
      }
      return; // Don't do normal cell selection in pose edit mode
    }

    // Normal cell click behavior
    const key = cellKey(row, col);
    const sound = getCellSound(row, col);
    if (sound) {
      // Sound found at this cell - select it
      setSelectedCellKey(key);
      setSelectedSoundId(null);
    } else {
      // Empty cell - deselect
      setSelectedCellKey(null);
      setSelectedSoundId(null);
    }
  };

  // Handle cell double-click
  const handleCellDoubleClick = (row: number, col: number) => {
    const key = cellKey(row, col);
    const sound = getCellSound(row, col);
    if (sound) {
      setSelectedCellKey(key);
      setSelectedSoundId(null);
      // Focus the name input after a short delay to ensure it's rendered
      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 50);
    }
  };

  // Handle context menu
  const handleCellContextMenu = (e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    const key = cellKey(row, col);
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetCell: key,
    });
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu?.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  // Derived lists: separate placed assets from staging assets
  const placedAssets = activeMapping
    ? Object.values(activeMapping.cells)
    : [];

  const placedAssetIds = new Set(placedAssets.map(s => s.id));

  const stagingAssets = parkedSounds.filter(sound => !placedAssetIds.has(sound.id));

  // Voice Visibility: Filter based on ignoredNoteNumbers
  const ignoredNoteNumbers = projectState.ignoredNoteNumbers || [];

  // Handler to toggle voice visibility
  const handleToggleVoiceVisibility = (noteNumber: number) => {
    const currentIgnored = projectState.ignoredNoteNumbers || [];
    const isIgnored = currentIgnored.includes(noteNumber);

    onUpdateProjectState({
      ...projectState,
      ignoredNoteNumbers: isIgnored
        ? currentIgnored.filter(n => n !== noteNumber) // Remove from ignored (show)
        : [...currentIgnored, noteNumber], // Add to ignored (hide)
    });
  };

  // Handler for destructive delete: Permanently remove all events for a noteNumber
  const handleDestructiveDelete = (noteNumber: number) => {
    if (!activeLayout) {
      console.warn('No active layout to delete from');
      return;
    }

    // Find the active layout
    const layoutIndex = projectState.layouts.findIndex(l => l.id === activeLayout.id);
    if (layoutIndex === -1) {
      console.warn('Active layout not found in project state');
      return;
    }

    // Filter out all events matching this noteNumber
    const updatedLayouts = projectState.layouts.map((layout, idx) => {
      if (idx === layoutIndex) {
        return {
          ...layout,
          performance: {
            ...layout.performance,
            events: layout.performance.events.filter(e => e.noteNumber !== noteNumber),
          },
        };
      }
      return layout;
    });

    // Remove from ignoredNoteNumbers (cleanup)
    const currentIgnored = projectState.ignoredNoteNumbers || [];
    const updatedIgnored = currentIgnored.filter(n => n !== noteNumber);

    // Update state
    onUpdateProjectState({
      ...projectState,
      layouts: updatedLayouts,
      ignoredNoteNumbers: updatedIgnored,
    });
  };



  // Update reachability config when activeMapping changes (in case anchor cell was moved)
  useEffect(() => {
    if (reachabilityConfig && activeMapping) {
      // Check if the anchor cell still exists and update position if needed
      const anchorCell = activeMapping.cells[reachabilityConfig.anchorCellKey];
      if (!anchorCell) {
        // Anchor cell was removed, clear reachability
        setReachabilityConfig(null);
      } else {
        // Verify the position is still correct (it should be, but update just in case)
        const parsed = parseCellKey(reachabilityConfig.anchorCellKey);
        if (parsed) {
          // Position should match, but ensure it's in sync
          if (parsed.row !== reachabilityConfig.anchorPos.row ||
            parsed.col !== reachabilityConfig.anchorPos.col) {
            setReachabilityConfig({
              ...reachabilityConfig,
              anchorPos: { row: parsed.row, col: parsed.col },
            });
          }
        }
      }
    }
  }, [activeMapping, reachabilityConfig]);

  // Compute reachability map if active
  const reachabilityMap = reachabilityConfig
    ? getReachabilityMap(
      reachabilityConfig.anchorPos,
      reachabilityConfig.anchorFinger,
      reachabilityConfig.targetFinger
    )
    : null;

  // Get filtered performance using selector (excludes ignored notes)
  // This is the computed performance that should be used everywhere instead of raw activeLayout.performance
  // @ts-ignore
  const filteredPerformance = useMemo(() => {
    return getActivePerformance(projectState);
  }, [projectState]);

  // Engine execution moved to Workbench.tsx (reactive solver loop)
  // Engine result is now passed as a prop from Workbench


  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-full w-full flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden">
        {/* Minimal Toolbar - Root Note and Auto-Layout only (Save/Load moved to main Workbench header) */}
        <div className="flex-none border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] px-4 py-2">
          <div className="flex items-center gap-4">

          </div>
        </div>

        {/* Main Content Area - Strict 3-Column Layout */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Left Panel (w-80) - Tabbed: Library | Pose */}
          <div className="w-80 flex-none border-r border-[var(--border-subtle)] bg-[var(--bg-app)] flex flex-col overflow-hidden">
            {/* Top-level Tabs: Library | Pose */}
            <div className="flex-none border-b border-[var(--border-subtle)]">
              <div className="flex">
                <button
                  onClick={() => {
                    setLeftPanelTab('library');
                    if (isPoseEditMode) {
                      setIsPoseEditMode(false);
                      setActiveFinger(null);
                    }
                  }}
                  className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
                    leftPanelTab === 'library'
                      ? 'text-[var(--text-primary)] border-b-2 border-blue-500 bg-[var(--bg-panel)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                  }`}
                >
                  Library
                </button>
                <button
                  onClick={() => setLeftPanelTab('pose')}
                  className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
                    leftPanelTab === 'pose'
                      ? 'text-[var(--text-primary)] border-b-2 border-blue-500 bg-[var(--bg-panel)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                  }`}
                >
                  Pose
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {leftPanelTab === 'library' ? (
              <VoiceLibrary
                parkedSounds={stagingAssets}
                activeMapping={activeMapping}
                projectState={projectState}
                selectedSoundId={selectedSoundId}
                selectedCellKey={selectedCellKey}
                ignoredNoteNumbers={ignoredNoteNumbers}
                onSelectSound={(id) => {
                  setSelectedSoundId(id);
                  setSelectedCellKey(null);
                }}
                onSelectCell={(key) => {
                  setSelectedCellKey(key);
                  setSelectedSoundId(null);
                }}
                onAddSound={onAddSound}
                onUpdateSound={onUpdateSound}
                onUpdateMappingSound={onUpdateMappingSound}
                onDeleteSound={(id) => onDeleteSound?.(id)}
                onToggleVoiceVisibility={handleToggleVoiceVisibility}
                handleDestructiveDelete={handleDestructiveDelete}
                handleClearStaging={handleClearStaging}
              />
            ) : (
              <NaturalHandPosePanel
                pose0={pose0}
                onUpdatePose0={handleUpdatePose0}
                activeFinger={activeFinger}
                onSetActiveFinger={setActiveFinger}
                previewOffset={previewOffset}
                onSetPreviewOffset={setPreviewOffset}
                isEditMode={isPoseEditMode}
                onToggleEditMode={handleTogglePoseEditMode}
              />
            )}
          </div>

          {/* Center Panel (flex-1) - GridEditor (top) & Timeline (bottom) */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Top: GridEditor (flex-1, centered) */}
            <div
              className="flex-1 flex flex-col items-center justify-center overflow-hidden p-2 bg-[var(--bg-app)] min-h-0 relative"
              style={{ containerType: 'size' } as React.CSSProperties}
            >
              {/* ============================================================================ */}
              {/* EXPLICIT LAYOUT CONTROLS TOOLBAR REMOVED - Moved to Workbench Header */}
              {/* ============================================================================ */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
                {/* Layout Mode Indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg pointer-events-auto shadow-lg backdrop-blur-md">
                  <div className={`w-2 h-2 rounded-full ${activeMapping?.layoutMode === 'optimized' ? 'bg-emerald-500' :
                    activeMapping?.layoutMode === 'random' ? 'bg-amber-500' :
                      activeMapping?.layoutMode === 'manual' ? 'bg-blue-500' :
                        'bg-slate-500'
                    }`} />
                  <span className="text-xs text-[var(--text-secondary)] font-medium">
                    {activeMapping?.layoutMode === 'optimized' ? 'Optimized Layout' :
                      activeMapping?.layoutMode === 'random' ? 'Random Layout' :
                        activeMapping?.layoutMode === 'manual' ? 'Manual Layout' :
                          'No Layout'}
                  </span>
                  {activeMapping?.version && (
                    <span className="text-[10px] text-[var(--text-secondary)] opacity-60">v{activeMapping.version}</span>
                  )}
                </div>
              </div>
              <div
                className="grid grid-cols-8 gap-2 bg-[var(--bg-panel)] p-4 rounded-xl shadow-2xl border border-[var(--border-subtle)]"
                style={{
                  width: 'calc(100cqmin - 32px)',
                  height: 'calc(100cqmin - 32px)',
                  aspectRatio: '1/1'
                }}
              >
                {rows.map((row) => (
                  <React.Fragment key={`row-${row}`}>
                    {cols.map((col) => {
                      const key = cellKey(row, col);
                      const assignedSound = getCellSound(row, col);
                      const isOver = Boolean(activeId && overId === key);


                      const cellKeyStr = cellKey(row, col);
                      const reachabilityLevel = reachabilityMap?.[cellKeyStr] || null;

                      // Get finger assignment data for cell coloring using the pre-computed map
                      let heatmapDifficulty: 'Easy' | 'Medium' | 'Hard' | 'Unplayable' | null = null;
                      let heatmapFinger: FingerID | null = null;
                      let heatmapHand: 'LH' | 'RH' | null = null;

                      // Look up finger assignment for this cell's note
                      if (assignedSound && assignedSound.originalMidiNote !== null) {
                        const assignment = fingerAssignmentMap.get(assignedSound.originalMidiNote);
                        if (assignment) {
                          heatmapFinger = assignment.finger;
                          heatmapHand = assignment.hand;
                          heatmapDifficulty = assignment.difficulty as 'Easy' | 'Medium' | 'Hard' | 'Unplayable';
                        }
                      }

                      const isHighlighted = false;
                      // Get finger constraint for this cell
                      const fingerConstraint = activeMapping?.fingerConstraints[cellKeyStr] || null;

                      // Pose ghost markers only visible during pose edit mode (backend data otherwise)
                      const ghostMarker = (isPoseEditMode && leftPanelTab === 'pose')
                        ? poseGhostMarkers.get(cellKeyStr)
                        : undefined;

                      return (
                        <DroppableCell
                          key={key}
                          row={row}
                          col={col}
                          assignedSound={assignedSound}
                          isOver={isOver}
                          isSelected={selectedCellKey === key}
                          isHighlighted={isHighlighted}
                          templateSlot={null}
                          reachabilityLevel={reachabilityLevel}
                          heatmapDifficulty={heatmapDifficulty}
                          heatmapFinger={heatmapFinger}
                          heatmapHand={heatmapHand}
                          fingerConstraint={fingerConstraint}
                          showNoteLabels={showNoteLabels}
                          showPositionLabels={showPositionLabels}
                          instrumentConfig={instrumentConfig}
                          onUpdateSound={(updates) => onUpdateMappingSound(cellKeyStr, updates)}
                          onClick={() => handleCellClick(row, col)}
                          onDoubleClick={() => handleCellDoubleClick(row, col)}
                          onContextMenu={(e) => handleCellContextMenu(e, row, col)}
                          poseGhostMarker={ghostMarker ?? null}
                          isPoseEditMode={isPoseEditMode && leftPanelTab === 'pose'}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* Finger Legend - Centered below grid */}
              <FingerLegend />
            </div>

            {/* Bottom: Performance Timeline - REMOVED: Now rendered in Workbench Dashboard section */}
            {/* Timeline is now displayed in the Dashboard section at the top of Workbench to avoid duplication */}
          </div>


        </div>

        {/* Context Menu */}
        {contextMenu?.visible && (
          <div
            ref={contextMenuRef}
            className="fixed bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-md shadow-xl z-50 min-w-[180px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y > window.innerHeight - 350 ? undefined : contextMenu.y,
              bottom: contextMenu.y > window.innerHeight - 350 ? window.innerHeight - contextMenu.y : undefined,
            }}
          >
            <div className="py-1">
              <div className="px-3 py-2 text-xs text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">
                Cell: {contextMenu.targetCell}
              </div>

              <div className="px-2 py-1">
                <div className="px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] uppercase">Reachability</div>
                <button
                  onClick={() => {
                    if (contextMenu) {
                      const parsed = parseCellKey(contextMenu.targetCell);
                      if (parsed) {
                        setReachabilityConfig({
                          anchorCellKey: contextMenu.targetCell,
                          anchorPos: { row: parsed.row, col: parsed.col },
                          anchorFinger: 1,
                          targetFinger: 1,
                          hand: 'L',
                        });
                      }
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded"
                >
                  Show Reach for L1
                </button>
                <button
                  onClick={() => {
                    if (contextMenu) {
                      const parsed = parseCellKey(contextMenu.targetCell);
                      if (parsed) {
                        setReachabilityConfig({
                          anchorCellKey: contextMenu.targetCell,
                          anchorPos: { row: parsed.row, col: parsed.col },
                          anchorFinger: 1,
                          targetFinger: 1,
                          hand: 'R',
                        });
                      }
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-card)] rounded"
                >
                  Show Reach for R1
                </button>
              </div>

              {/* Finger Assignment Section */}
              {activeMapping && (
                <>
                  <div className="border-t border-[var(--border-subtle)] my-1" />
                  <div className="px-3 py-2 text-xs text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">
                    Assign Finger Lock
                  </div>

                  {/* Left Hand Fingers */}
                  <div className="px-2 py-1">
                    <div className="px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] uppercase">Left Hand</div>
                    {[1, 2, 3, 4, 5].map((finger) => {
                      const currentConstraint = activeMapping.fingerConstraints[contextMenu.targetCell];
                      const constraintValue = `L${finger}`;
                      const isActive = currentConstraint === constraintValue;
                      const fingerName = finger === 1 ? 'Thumb' : finger === 2 ? 'Index' : finger === 3 ? 'Middle' : finger === 4 ? 'Ring' : 'Pinky';
                      return (
                        <button
                          key={`finger-L${finger}`}
                          onClick={() => {
                            if (activeMapping) {
                              const newConstraints = { ...activeMapping.fingerConstraints };
                              if (isActive) {
                                delete newConstraints[contextMenu.targetCell];
                              } else {
                                newConstraints[contextMenu.targetCell] = constraintValue;
                              }
                              onUpdateMapping({ fingerConstraints: newConstraints });
                            }
                            setContextMenu(null);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-sm rounded ${isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                            }`}
                        >
                          {isActive ? '✓ ' : ''}L{finger} ({fingerName})
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Hand Fingers */}
                  <div className="px-2 py-1">
                    <div className="px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] uppercase">Right Hand</div>
                    {[1, 2, 3, 4, 5].map((finger) => {
                      const currentConstraint = activeMapping.fingerConstraints[contextMenu.targetCell];
                      const constraintValue = `R${finger}`;
                      const isActive = currentConstraint === constraintValue;
                      const fingerName = finger === 1 ? 'Thumb' : finger === 2 ? 'Index' : finger === 3 ? 'Middle' : finger === 4 ? 'Ring' : 'Pinky';
                      return (
                        <button
                          key={`finger-R${finger}`}
                          onClick={() => {
                            if (activeMapping) {
                              const newConstraints = { ...activeMapping.fingerConstraints };
                              if (isActive) {
                                delete newConstraints[contextMenu.targetCell];
                              } else {
                                newConstraints[contextMenu.targetCell] = constraintValue;
                              }
                              onUpdateMapping({ fingerConstraints: newConstraints });
                            }
                            setContextMenu(null);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-sm rounded ${isActive
                            ? 'bg-blue-600 text-white'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                            }`}
                        >
                          {isActive ? '✓ ' : ''}R{finger} ({fingerName})
                        </button>
                      );
                    })}
                  </div>

                  {/* Clear Finger Lock */}
                  {activeMapping.fingerConstraints[contextMenu.targetCell] && (
                    <>
                      <div className="border-t border-[var(--border-subtle)] my-1" />
                      <button
                        onClick={() => {
                          if (activeMapping) {
                            const newConstraints = { ...activeMapping.fingerConstraints };
                            delete newConstraints[contextMenu.targetCell];
                            onUpdateMapping({ fingerConstraints: newConstraints });
                          }
                          setContextMenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-[var(--text-warning)] hover:bg-[var(--bg-card)] rounded"
                      >
                        Clear Finger Lock
                      </button>
                    </>
                  )}
                </>
              )}

              {activeMapping?.cells[contextMenu.targetCell] && (
                <>
                  <div className="border-t border-[var(--border-subtle)] my-1" />
                  <button
                    onClick={() => {
                      onRemoveSound(contextMenu.targetCell);
                      setContextMenu(null);
                      setSelectedCellKey(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-[var(--text-warning)] hover:bg-[var(--bg-card)] rounded"
                  >
                    Remove Sound
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedSound ? (
            <div
              className="p-3 rounded-md border bg-[var(--finger-L1)] border-[var(--finger-L2)] shadow-lg"
              style={{
                borderLeftWidth: '4px',
                borderLeftColor: draggedSound.color || 'var(--finger-L1)',
              }}
            >
              <div className="font-medium text-white text-sm">
                {draggedSound.name}
              </div>
              <div className="text-xs text-white/80 mt-1">
                {draggedSound.sourceType === 'midi_track' ? 'MIDI' : 'Audio'}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>

    </DndContext>
  );
};
