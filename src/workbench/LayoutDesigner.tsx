import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Voice, GridMapping, cellKey, parseCellKey, TemplateId, LAYOUT_TEMPLATES, LayoutTemplate } from '../types/layout';
import { getReachabilityMap, ReachabilityLevel } from '../engine/feasibility';
import { GridPosition } from '../engine/gridMath';
import { FingerID } from '../types/engine';
// MIDI import logic removed - handled by parent Workbench component
import { InstrumentConfig } from '../types/performance';
import { GridMapService } from '../engine/gridMapService';
import { mapToQuadrants } from '../utils/autoLayout';
import { exportLayout, importLayout } from '../utils/projectPersistence';
import { ProjectState, LayoutSnapshot } from '../types/projectState';
import { ImportWizard } from './ImportWizard';
import { EngineResult } from '../engine/core';

import { SoundAssignmentTable } from './SoundAssignmentTable';
import { getActivePerformance, getRawActivePerformance } from '../utils/performanceSelectors';

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
  /** Callback to assign multiple Voices to Pads at once (batch Assignment operations) */
  onAssignSounds: (assignments: Record<string, Voice>) => void;
  /** Callback when mapping metadata is updated */
  onUpdateMapping: (updates: Partial<GridMapping>) => void;
  /** Callback to duplicate the current mapping */
  onDuplicateMapping: () => void;
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
  /** Callback to set the active mapping ID */
  onSetActiveMappingId?: (id: string) => void;
  /** Active layout for performance analysis */
  activeLayout: LayoutSnapshot | null;


  /** View Settings: Show Cell labels (Voice MIDI note numbers) on Pads */
  showNoteLabels?: boolean;
  /** View Settings: View all steps (flatten time) */
  viewAllSteps?: boolean;
  /** View Settings: Show heatmap overlay */
  showHeatmap?: boolean;
  /** Callback when user wants to import a MIDI file */
  onImport?: (file: File) => void;
  /** Engine result from Workbench (reactive solver loop) */
  engineResult?: EngineResult | null;
}

/**
 * Draggable Voice Item Component
 * 
 * A Voice can be dragged and assigned to a Pad.
 * This creates an Assignment relationship: Voice → Pad.
 */
interface DraggableSoundProps {
  sound: Voice;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (updates: Partial<Voice>) => void;
  onDelete: () => void;
  /** Whether this Voice is visible (not ignored) */
  isVisible?: boolean;
  /** Callback to toggle Voice visibility (by Cell/MIDI note number) */
  onToggleVisibility?: (noteNumber: number) => void;
}

const DraggableSound: React.FC<DraggableSoundProps> = ({
  sound,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  isVisible = true,
  onToggleVisibility,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(sound.name);
  const [editColor, setEditColor] = useState(sound.color || '#6366f1');
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: sound.id,
  });

  const style = transform
    ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    }
    : undefined;

  const handleSave = () => {
    onEdit({ name: editName, color: editColor });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(sound.name);
    setEditColor(sound.color || '#6366f1');
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      {...(!isEditing ? listeners : {})}
      {...(!isEditing ? attributes : {})}
      onClick={!isEditing ? onSelect : undefined}
      className={`
        p-3 rounded-md border transition-all duration-150
        ${isDragging
          ? 'bg-blue-600 border-blue-400 shadow-lg scale-105 opacity-50 cursor-grabbing'
          : isEditing
            ? 'bg-slate-700 border-blue-500 cursor-default'
            : isSelected
              ? 'bg-slate-700 border-blue-500 cursor-pointer'
              : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600 cursor-grab active:cursor-grabbing'
        }
      `}
      style={{
        ...style,
        borderLeftWidth: '4px',
        borderLeftColor: sound.color || '#6366f1',
      }}
    >
      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className="w-8 h-8 rounded border border-slate-600 cursor-pointer"
            />
            <button
              onClick={handleSave}
              className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-700 text-white rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-200 text-sm">
                {sound.name}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {sound.sourceType === 'midi_track' ? 'MIDI' : 'Audio'}
                {sound.originalMidiNote !== null && ` • Note ${sound.originalMidiNote}`}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Visibility toggle button */}
              {onToggleVisibility && sound.originalMidiNote !== null && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(sound.originalMidiNote!);
                  }}
                  className={`flex-shrink-0 p-1.5 rounded transition-colors ${isVisible
                    ? 'text-green-400 hover:bg-green-900/20'
                    : 'text-slate-500 hover:bg-slate-700'
                    }`}
                  title={isVisible ? 'Hide Voice' : 'Show Voice'}
                >
                  {isVisible ? '👁️' : '🚫'}
                </button>
              )}
              {/* Delete button - always visible */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete "${sound.name}" from library?`)) {
                    onDelete();
                  }
                }}
                className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                title="Delete voice"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
          {isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="mt-2 w-full px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 rounded"
            >
              Edit
            </button>
          )}
        </>
      )}
    </div>
  );
};

// Placed Voice Item Component (for Library "Placed on Grid" section - shows Pad assignments)
interface PlacedSoundItemProps {
  sound: Voice;
  cellKey: string; // Pad key "row,col"
  isSelected: boolean;
  onSelect: () => void;
}

const PlacedSoundItem: React.FC<PlacedSoundItemProps> = ({ sound, cellKey, isSelected, onSelect }) => {
  const parsed = parseCellKey(cellKey);
  const coordText = parsed ? `[${parsed.row},${parsed.col}]` : cellKey;

  return (
    <div
      onClick={onSelect}
      className={`
        p-3 rounded-md border transition-all duration-150 cursor-pointer
        ${isSelected
          ? 'bg-slate-700 border-blue-500'
          : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600'
        }
      `}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: sound.color || '#6366f1',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium text-slate-200 text-sm flex-1">
          {sound.name}
        </div>
        <div className="text-xs text-slate-400 ml-2">
          {coordText}
        </div>
      </div>
      <div className="text-xs text-slate-400 mt-1">
        {sound.sourceType === 'midi_track' ? 'MIDI' : 'Audio'}
        {sound.originalMidiNote !== null && ` • Note ${sound.originalMidiNote}`}
      </div>
    </div>
  );
};

// Droppable Staging Area Component
interface DroppableStagingAreaProps {
  children: React.ReactNode;
}

const DroppableStagingArea: React.FC<DroppableStagingAreaProps> = ({ children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'staging-area',
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[100px] transition-colors rounded
        ${isOver ? 'bg-blue-900/20 border-2 border-dashed border-blue-500' : ''}
      `}
    >
      {children}
    </div>
  );
};

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
  instrumentConfig?: InstrumentConfig | null;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const DroppableCell: React.FC<DroppableCellProps> = ({
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
  // showNoteLabels = false,
  instrumentConfig = null,
  onClick,
  onDoubleClick,
  onContextMenu,
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

  // Dynamic Styles based on state
  const getBackgroundStyle = () => {
    if (assignedSound) {
      // If heatmap is active, overlay color
      if (heatmapDifficulty) {
        switch (heatmapDifficulty) {
          case 'Unplayable': return 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)'; // Red
          case 'Hard': return 'linear-gradient(135deg, #f97316 0%, #9a3412 100%)'; // Orange
          case 'Medium': return 'linear-gradient(135deg, #eab308 0%, #854d0e 100%)'; // Yellow
          default: return 'linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)'; // Blue (Easy)
        }
      }
      // Default sound color gradient
      return `linear-gradient(135deg, ${assignedSound.color || '#6366f1'} 0%, ${adjustColorBrightness(assignedSound.color || '#6366f1', -40)} 100%)`;
    }

    // Empty Cell State
    if (isDroppableOver || isOver) return 'rgba(59, 130, 246, 0.2)'; // Blue tint on hover
    return 'rgba(30, 41, 59, 0.4)'; // Default slate-800/40
  };

  // Helper to darken color for gradient
  const adjustColorBrightness = (hex: string, _percent: number) => {
    // Simple placeholder - in real app use a proper color lib
    return hex;
  }

  return (
    <div
      ref={combinedRef}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      {...(assignedSound && !isDragging ? listeners : {})}
      {...(assignedSound && !isDragging ? attributes : {})}
      className={`
        w-full aspect-square rounded-xl flex flex-col items-center justify-center
        transition-all duration-200 relative select-none
        ${isHighlighted ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] z-20' : ''}
        ${assignedSound
          ? isSelected
            ? 'ring-2 ring-white shadow-lg scale-[1.02] z-10'
            : isDragging
              ? 'opacity-50 scale-95 cursor-grabbing'
              : 'shadow-md hover:shadow-lg hover:scale-[1.02] cursor-grab active:cursor-grabbing'
          : isDroppableOver || isOver
            ? 'border-2 border-dashed border-blue-500/50 scale-95'
            : 'border border-slate-700/30 hover:bg-slate-700/30'
        }
      `}
      style={{
        ...dragStyle,
        background: getBackgroundStyle(),
        boxShadow: assignedSound && !isDragging ? 'inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 6px -1px rgba(0,0,0,0.3)' : undefined,
      }}
    >
      {assignedSound ? (
        <>
          {/* Sound Name */}
          <span className="text-[10px] font-bold text-white/90 tracking-wide uppercase truncate max-w-[90%] drop-shadow-md">
            {assignedSound.name}
          </span>

          {/* Note Info */}
          <span className="text-[9px] text-white/60 mt-0.5 font-mono">
            {noteNumber !== null ? getNoteName(noteNumber) : ''}
          </span>

          {/* Finger Badge (Top Right) */}
          {heatmapFinger && heatmapHand && (
            <div className={`
              absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm z-10 border border-white/20
              ${heatmapHand === 'LH' ? 'bg-blue-500 text-white' : 'bg-rose-500 text-white'}
            `}>
              {heatmapHand === 'LH' ? 'L' : 'R'}{heatmapFinger}
            </div>
          )}

          {/* Finger Constraint Lock (Top Left) */}
          {fingerConstraint && (
            <div className="absolute -top-1 -left-1 bg-slate-900/80 rounded-full p-0.5 border border-slate-600">
              <span className="text-[8px]">🔒</span>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Empty State Content */}
          {templateSlot ? (
            <div className="flex flex-col items-center opacity-40">
              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">
                {templateSlot.label}
              </span>
            </div>
          ) : (
            // Subtle coordinate for empty cells
            <span className="text-[8px] text-slate-600 font-mono opacity-0 hover:opacity-100 transition-opacity">
              {row},{col}
            </span>
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
  onAssignSounds,
  onUpdateMapping,
  onDuplicateMapping,
  onAddSound,
  onUpdateSound,
  onUpdateMappingSound,
  onRemoveSound,
  onDeleteSound,
  projectState,
  onUpdateProjectState,
  onSetActiveMappingId,
  activeLayout,


  showNoteLabels = false,
  // viewAllSteps = false,
  showHeatmap = false,
  onImport,
  engineResult: engineResultProp = null,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const importLayoutInputRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedSound, setDraggedSound] = useState<Voice | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('none');
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const [stagingAreaCollapsed, setStagingAreaCollapsed] = useState(false);
  const [placedSoundsCollapsed, setPlacedSoundsCollapsed] = useState(true); // Default to collapsed
  const [stagingAreaSectionCollapsed, setStagingAreaSectionCollapsed] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  // View Settings are now passed as props from Workbench
  // Keep local state for backward compatibility if needed, but use props
  // const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  // const [timelineForceVisible, setTimelineForceVisible] = useState(false);
  // const [timelineAutoHidden, setTimelineAutoHidden] = useState(false);
  // Engine result is now passed from Workbench (reactive solver loop)
  // Use prop if provided, otherwise fall back to null
  const engineResult = engineResultProp;
  const [leftPanelTab, setLeftPanelTab] = useState<'library'>('library');
  const [autoLayoutDropdownOpen, setAutoLayoutDropdownOpen] = useState(false);
  const autoLayoutDropdownRef = useRef<HTMLDivElement>(null);

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

    if (parsed) {
      // Magnetic snap: If a template is active, check if we're near a template slot
      if (selectedTemplate !== 'none') {
        const template = LAYOUT_TEMPLATES.find(t => t.id === selectedTemplate);
        if (template) {
          // Find the nearest template slot within snap distance (1.5 grid units)
          const snapDistance = 1.5;
          let nearestSlot: { row: number; col: number; label: string } | null = null;
          let minDistance = Infinity;

          for (const slot of template.slots) {
            const dx = slot.col - parsed.col;
            const dy = slot.row - parsed.row;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < snapDistance && distance < minDistance) {
              minDistance = distance;
              nearestSlot = slot;
            }
          }

          // If we found a nearby slot, snap to it
          if (nearestSlot) {
            targetCellKey = cellKey(nearestSlot.row, nearestSlot.col);
          }
        }
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
    }

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

  // Get the active template
  const activeTemplate: LayoutTemplate | null = selectedTemplate !== 'none'
    ? LAYOUT_TEMPLATES.find(t => t.id === selectedTemplate) || null
    : null;

  // Get template slot for a cell
  const getTemplateSlot = (row: number, col: number): { label: string; suggestedNote?: number } | null => {
    if (!activeTemplate) return null;
    const slot = activeTemplate.slots.find(s => s.row === row && s.col === col);
    return slot ? { label: slot.label, suggestedNote: slot.suggestedNote } : null;
  };

  // Handle creating new sound
  const handleNewSound = () => {
    const newSound: Voice = {
      id: `sound-${Date.now()}`,
      name: 'New Sound',
      sourceType: 'midi_track',
      sourceFile: '',
      originalMidiNote: null,
      color: '#333333',
    };
    onAddSound(newSound);
    setSelectedSoundId(newSound.id);
  };

  // Handle MIDI file import - delegate to parent component (Workbench)
  // All MIDI parsing and state updates are handled by Workbench.handleProjectLoad
  const handleMidiFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.warn('[LayoutDesigner] handleMidiFileSelect - No file selected');
      if (event.target) {
        event.target.value = '';
      }
      return;
    }

    console.log('[LayoutDesigner] handleMidiFileSelect - File selected:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      hasOnImport: !!onImport,
    });

    if (onImport) {
      console.log('[LayoutDesigner] handleMidiFileSelect - Calling onImport callback');
      try {
        onImport(file);
      } catch (error) {
        console.error('[LayoutDesigner] handleMidiFileSelect - Error calling onImport:', error);
      }
    } else {
      console.error('[LayoutDesigner] handleMidiFileSelect - onImport callback not provided - cannot import MIDI file');
    }

    // Reset input value so same file can be loaded again if needed
    if (event.target) {
      event.target.value = '';
    }
  };

  // Handle scan MIDI button click - show ImportWizard
  const handleScanMidiClick = () => {
    console.log('[LayoutDesigner] handleScanMidiClick - Button clicked', {
      fileInputRefExists: !!fileInputRef.current,
      fileInputRefValue: fileInputRef.current?.value,
    });

    if (fileInputRef.current) {
      console.log('[LayoutDesigner] handleScanMidiClick - Triggering file input click');
      fileInputRef.current.click();
    } else {
      console.error('[LayoutDesigner] handleScanMidiClick - fileInputRef.current is null!');
      // Fallback: show ImportWizard if file input ref is not available
      setShowImportWizard(true);
    }
  };

  // Handle ImportWizard confirm - add assets to parkedSounds
  const handleImportConfirm = (assets: Voice[]) => {
    assets.forEach((asset) => {
      onAddSound(asset);
    });
    setShowImportWizard(false);
  };

  // Handle ImportWizard cancel
  const handleImportCancel = () => {
    setShowImportWizard(false);
  };

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

  // Handle clear grid - moves all sounds back to staging
  const handleClearGrid = () => {
    if (!activeMapping) {
      return; // Nothing to clear
    }

    if (window.confirm('Are you sure you want to clear all sounds from the grid? All sounds will be moved back to staging.')) {
      // Collect all sounds from the grid
      const soundsToMove = Object.values(activeMapping.cells);

      // Add sounds back to parkedSounds if they're not already there
      soundsToMove.forEach(sound => {
        const isInParked = parkedSounds.some(s => s.id === sound.id);
        if (!isInParked) {
          onAddSound(sound);
        }
      });

      // Clear the grid
      onUpdateMapping({
        cells: {},
      });
      setSelectedCellKey(null);
      setReachabilityConfig(null);
    }
  };

  // Note: Save/Load Project functionality moved to main Workbench header to avoid duplication

  // Handle export current layout
  const handleExportLayout = () => {
    if (!activeMapping) {
      alert('No active layout to export. Please create or select a layout first.');
      return;
    }
    exportLayout(activeMapping, parkedSounds);
  };

  // Handle import layout
  const handleImportLayoutClick = () => {
    if (importLayoutInputRef.current) {
      importLayoutInputRef.current.click();
    }
  };

  const handleImportLayout = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = '';
      return;
    }

    try {
      const updatedState = await importLayout(file, projectState);
      onUpdateProjectState(updatedState);
      // Set the imported mapping as active
      if (updatedState.mappings.length > 0 && onSetActiveMappingId) {
        const importedMapping = updatedState.mappings[updatedState.mappings.length - 1];
        onSetActiveMappingId(importedMapping.id);
      }
      event.target.value = '';
    } catch (err) {
      console.error('Failed to import layout:', err);
      alert(`Failed to import layout: ${err instanceof Error ? err.message : 'Unknown error'}`);
      event.target.value = '';
    }
  };

  // Keyboard shortcuts
  // Note: Ctrl+S keyboard shortcut removed - Save Project is handled by main Workbench header

  // Handle auto-layout to quadrants
  const handleMapToQuadrants = () => {
    if (!instrumentConfig) {
      alert('No instrument configuration available. Cannot perform auto-layout.');
      return;
    }

    // Collect all sounds that have originalMidiNote set
    // Use derived lists to avoid duplicates
    const soundsWithNotes: Voice[] = [
      ...placedAssets.filter(s => s.originalMidiNote !== null),
      ...stagingAssets.filter(s => s.originalMidiNote !== null),
    ];

    if (soundsWithNotes.length === 0) {
      alert('No sounds with MIDI note information found. Sounds need originalMidiNote to be auto-laid out.');
      return;
    }

    // Map sounds to quadrants
    const assignments = mapToQuadrants(soundsWithNotes, instrumentConfig.bottomLeftNote);

    if (Object.keys(assignments).length === 0) {
      alert('No sounds could be mapped to quadrants. Check that sounds have valid MIDI note numbers.');
      return;
    }

    // If no active mapping exists, create one by assigning the first sound
    // This will trigger mapping creation, then we can update it
    if (!activeMapping) {
      const firstAssignment = Object.entries(assignments)[0];
      if (firstAssignment) {
        const [cellKey, sound] = firstAssignment;
        onAssignSound(cellKey, sound);

        // Wait a moment for the mapping to be created, then update with all assignments
        setTimeout(() => {
          onUpdateMapping({
            cells: assignments,
            name: 'Quadrant Layout',
            notes: 'Auto-laid out to 4x4 quadrants',
          });
        }, 10);
        return;
      }
    }

    // Replace all cells with the new quadrant layout (this clears old cells and applies new ones)
    onUpdateMapping({
      cells: assignments,
      notes: activeMapping?.notes
        ? `${activeMapping.notes}\n\nAuto-laid out to 4x4 quadrants`
        : 'Auto-laid out to 4x4 quadrants',
    });
  };

  // Handle cell click - selects the sound asset at that coordinate
  const handleCellClick = (row: number, col: number) => {
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

  // Handle auto-assign random: Map unassigned Voices to empty Pads
  const handleAutoAssignRandom = () => {
    if (!activeMapping || !instrumentConfig) {
      alert('No active mapping or instrument config available. Please create a mapping first.');
      return;
    }

    // Find all unassigned Voices (in staging, not yet assigned to a Pad)
    const unassignedVoices = stagingAssets;

    if (unassignedVoices.length === 0) {
      alert('No unassigned Voices found. All Voices are already assigned to Pads.');
      return;
    }

    // Find all empty Pads (8x8 grid positions without a Voice assignment)
    const emptyPads: Array<{ row: number; col: number; key: string }> = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const key = cellKey(row, col);
        if (!activeMapping.cells[key]) {
          emptyPads.push({ row, col, key });
        }
      }
    }

    if (emptyPads.length === 0) {
      alert('No empty Pads available. All 64 Pads are already assigned.');
      return;
    }

    // Randomly shuffle both arrays
    const shuffledVoices = [...unassignedVoices].sort(() => Math.random() - 0.5);
    const shuffledPads = [...emptyPads].sort(() => Math.random() - 0.5);

    // Map voices to pads (up to the minimum of available voices and empty pads)
    const assignments: Record<string, Voice> = {};
    const maxAssignments = Math.min(shuffledVoices.length, shuffledPads.length);

    for (let i = 0; i < maxAssignments; i++) {
      assignments[shuffledPads[i].key] = shuffledVoices[i];
    }

    // Batch assign all at once
    if (Object.keys(assignments).length > 0) {
      if (onAssignSounds) {
        onAssignSounds(assignments);
      } else {
        // Fallback: assign individually
        Object.entries(assignments).forEach(([key, voice]) => {
          onAssignSound(key, voice);
        });
      }
    }
  };

  // Get selected sound (from library or grid)
  const selectedSound = selectedCellKey && activeMapping
    ? activeMapping.cells[selectedCellKey] || null
    : selectedSoundId
      ? stagingAssets.find(s => s.id === selectedSoundId) || null
      : null;

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
  const filteredPerformance = useMemo(() => {
    return getActivePerformance(projectState);
  }, [projectState]);

  // Also get raw performance for operations that need all events (like destructive delete)
  const rawPerformance = useMemo(() => {
    return getRawActivePerformance(projectState);
  }, [projectState]);

  // Engine execution moved to Workbench.tsx (reactive solver loop)
  // Engine result is now passed as a prop from Workbench

  // Close auto-layout dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autoLayoutDropdownRef.current && !autoLayoutDropdownRef.current.contains(event.target as Node)) {
        setAutoLayoutDropdownOpen(false);
      }
    };

    if (autoLayoutDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [autoLayoutDropdownOpen]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-full w-full flex flex-col bg-gray-900 text-white overflow-hidden">
        {/* Minimal Toolbar - Root Note and Auto-Layout only (Save/Load moved to main Workbench header) */}
        <div className="flex-none border-b border-gray-700 bg-slate-800 px-4 py-2">
          <div className="flex items-center gap-4">


            {/* Auto-Layout Dropdown */}
            <div className="relative" ref={autoLayoutDropdownRef}>
              <button
                onClick={() => setAutoLayoutDropdownOpen(!autoLayoutDropdownOpen)}
                className="px-3 py-1.5 text-xs bg-purple-700 hover:bg-purple-600 text-white rounded border border-purple-600 transition-colors"
                disabled={!instrumentConfig}
                title={!instrumentConfig ? 'No instrument config available' : 'Auto-Layout Options'}
              >
                Auto-Layout ▼
              </button>
              {autoLayoutDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl z-50 min-w-[200px]">
                  <button
                    onClick={() => {
                      handleMapToQuadrants();
                      setAutoLayoutDropdownOpen(false);
                    }}
                    disabled={!instrumentConfig}
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                  >
                    Organize by 4x4 Banks
                  </button>
                  <button
                    onClick={() => {
                      // Placeholder for future "Suggest Ergonomic Layout" feature
                      alert('Ergonomic Layout suggestion coming soon!');
                      setAutoLayoutDropdownOpen(false);
                    }}
                    disabled
                    className="w-full text-left px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
                  >
                    Suggest Ergonomic Layout (Coming Soon)
                  </button>
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-slate-700" />

            {/* Export/Import Layout (layout-specific, not project-wide) */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportLayout}
                disabled={!activeMapping}
                className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded transition-colors"
                title={!activeMapping ? 'No active layout to export' : 'Export Current Layout'}
              >
                Export Layout
              </button>
              <button
                onClick={handleImportLayoutClick}
                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
                title="Import Layout"
              >
                Import Layout
              </button>
              <input
                ref={importLayoutInputRef}
                type="file"
                accept=".json"
                onChange={handleImportLayout}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Main Content Area - Strict 3-Column Layout */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Left Panel (w-80) - Tabbed: Library & Sections */}
          <div className="w-80 flex-none border-r border-gray-700 bg-slate-900 flex flex-col overflow-hidden">
            {/* Layout Actions - Above Tabs */}
            <div className="flex-none border-b border-slate-700 p-3 bg-slate-800/50">
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Layout Actions</div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={onDuplicateMapping}
                  disabled={!activeMapping}
                  className="w-full px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-200 rounded border border-slate-600 disabled:border-slate-700 transition-colors"
                  title="Duplicate current layout"
                >
                  Duplicate
                </button>
                <button
                  onClick={handleClearGrid}
                  disabled={!activeMapping || Object.keys(activeMapping.cells).length === 0}
                  className="w-full px-3 py-1.5 text-xs bg-red-900/30 hover:bg-red-900/50 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-red-300 disabled:text-slate-500 rounded border border-red-900/50 disabled:border-slate-700 transition-colors"
                  title={!activeMapping || Object.keys(activeMapping.cells).length === 0 ? 'No cells to clear' : 'Remove all sounds from the grid'}
                >
                  Clear Grid
                </button>
                <button
                  onClick={handleClearStaging}
                  disabled={stagingAssets.length === 0}
                  className="w-full px-3 py-1.5 text-xs bg-orange-900/30 hover:bg-orange-900/50 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-orange-300 disabled:text-slate-500 rounded border border-orange-900/50 disabled:border-slate-700 transition-colors"
                  title={stagingAssets.length === 0 ? 'No sounds in staging' : `Remove all ${stagingAssets.length} sound(s) from staging`}
                >
                  Clear Staging
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex-none border-b border-slate-700">
              <div className="flex">
                <button
                  onClick={() => setLeftPanelTab('library')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${leftPanelTab === 'library'
                    ? 'bg-slate-800 text-slate-200 border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                >
                  Library
                </button>

              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-200">Library</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleNewSound}
                      className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded border border-green-500 transition-colors"
                      title="Add New Sound"
                    >
                      + New
                    </button>
                    <button
                      onClick={handleScanMidiClick}
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded border border-blue-500 transition-colors"
                      disabled={!instrumentConfig}
                      title={!instrumentConfig ? 'No instrument config available' : 'Import MIDI file'}
                    >
                      Import MIDI
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".mid,.midi"
                      onChange={handleMidiFileSelect}
                      className="hidden"
                      id="midi-file-input"
                      name="midi-file-input"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Detected Voices Section - Derived from active Performance (for visibility/delete management) */}
                  <div>
                    <button
                      onClick={() => setStagingAreaCollapsed(!stagingAreaCollapsed)}
                      className="w-full flex items-center justify-between p-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded transition-colors"
                    >
                      <span>Detected Voices</span>
                      <span className="text-xs text-slate-500">
                        {(() => {
                          const rawPerformance = getRawActivePerformance(projectState);
                          if (!rawPerformance) return '0 voices';
                          const uniqueNotes = new Set(rawPerformance.events.map(e => e.noteNumber));
                          return `${uniqueNotes.size} ${uniqueNotes.size === 1 ? 'voice' : 'voices'}`;
                        })()}
                      </span>
                      <span className="text-slate-500">
                        {stagingAreaCollapsed ? '▼' : '▲'}
                      </span>
                    </button>
                    {!stagingAreaCollapsed && (
                      <div className="mt-2">
                        {(() => {
                          const rawPerformance = getRawActivePerformance(projectState);
                          if (!rawPerformance || rawPerformance.events.length === 0) {
                            return (
                              <div className="text-sm text-slate-500 text-center py-8 border-2 border-dashed border-slate-700 rounded">
                                No Voices detected
                                <br />
                                <span className="text-xs">Import a MIDI file to detect voices</span>
                              </div>
                            );
                          }

                          // Extract unique noteNumbers from the raw Performance
                          const uniqueNotes = Array.from(new Set(rawPerformance.events.map(e => e.noteNumber))).sort((a, b) => a - b);

                          return (
                            <div className="space-y-2">
                              {uniqueNotes.map((noteNumber) => {
                                const isVisible = !ignoredNoteNumbers.includes(noteNumber);
                                const eventCount = rawPerformance.events.filter(e => e.noteNumber === noteNumber).length;

                                return (
                                  <div
                                    key={noteNumber}
                                    className="p-3 rounded-md border bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-colors flex items-center justify-between gap-2"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-slate-200 text-sm">
                                        Note {noteNumber}
                                      </div>
                                      <div className="text-xs text-slate-400 mt-1">
                                        {eventCount} {eventCount === 1 ? 'event' : 'events'}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {/* Visibility Toggle */}
                                      <button
                                        onClick={() => handleToggleVoiceVisibility(noteNumber)}
                                        className={`flex-shrink-0 p-1.5 rounded transition-colors ${isVisible
                                          ? 'text-green-400 hover:bg-green-900/20'
                                          : 'text-slate-500 hover:bg-slate-700'
                                          }`}
                                        title={isVisible ? 'Hide Voice' : 'Show Voice'}
                                      >
                                        {isVisible ? '👁️' : '🚫'}
                                      </button>
                                      {/* Destructive Delete */}
                                      <button
                                        onClick={() => {
                                          if (window.confirm(`Permanently delete all events for Note ${noteNumber}? This action cannot be undone.`)) {
                                            handleDestructiveDelete(noteNumber);
                                          }
                                        }}
                                        className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                                        title="Permanently delete all events for this note"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-4 w-4"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={2}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                          />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Staging Area Section - Draggable Voices */}
                  <div>
                    <button
                      onClick={() => setStagingAreaSectionCollapsed(!stagingAreaSectionCollapsed)}
                      className="w-full flex items-center justify-between p-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded transition-colors"
                    >
                      <span>Staging Area</span>
                      <span className="text-xs text-slate-500">
                        {stagingAssets.length} {stagingAssets.length === 1 ? 'voice' : 'voices'}
                      </span>
                      <span className="text-slate-500">
                        {stagingAreaSectionCollapsed ? '▼' : '▲'}
                      </span>
                    </button>
                    {!stagingAreaSectionCollapsed && (
                      <DroppableStagingArea>
                        {/* Assign Actions Toolbar */}
                        {stagingAssets.length > 0 && (
                          <div className="mb-3 p-2 bg-slate-800/50 rounded border border-slate-700">
                            <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Assign Actions</div>
                            <div className="flex gap-2">
                              <button
                                onClick={handleAutoAssignRandom}
                                disabled={!activeMapping || !instrumentConfig || stagingAssets.length === 0}
                                className="flex-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded border border-blue-500 disabled:border-slate-600 transition-colors"
                                title={!activeMapping || !instrumentConfig ? 'No active mapping or instrument config' : 'Randomly assign unassigned Voices to empty Pads'}
                              >
                                Auto-Assign (Random)
                              </button>
                              <button
                                disabled
                                className="flex-1 px-3 py-1.5 text-xs bg-slate-700 text-slate-500 cursor-not-allowed rounded border border-slate-600 flex items-center justify-center gap-1"
                                title="AI Optimization coming in v2"
                              >
                                Auto-Assign (Optimize) 🧠
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-2 mt-2">
                          {stagingAssets.length === 0 ? (
                            <div className="text-sm text-slate-500 text-center py-8 border-2 border-dashed border-slate-700 rounded">
                              No Voices in staging
                              <br />
                              <span className="text-xs">Drag Voices from grid here to unassign</span>
                            </div>
                          ) : (
                            stagingAssets.map((sound) => {
                              const isVisible = sound.originalMidiNote === null
                                ? true
                                : !ignoredNoteNumbers.includes(sound.originalMidiNote);

                              return (
                                <DraggableSound
                                  key={sound.id}
                                  sound={sound}
                                  isSelected={selectedSoundId === sound.id && !selectedCellKey}
                                  onSelect={() => {
                                    setSelectedSoundId(sound.id);
                                    setSelectedCellKey(null);
                                  }}
                                  onEdit={(updates) => onUpdateSound(sound.id, updates)}
                                  onDelete={() => onDeleteSound?.(sound.id)}
                                  isVisible={isVisible}
                                  onToggleVisibility={handleToggleVoiceVisibility}
                                />
                              );
                            })
                          )}
                        </div>
                      </DroppableStagingArea>
                    )}
                  </div>

                  {/* Placed on Grid Section */}
                  {activeMapping && Object.keys(activeMapping.cells).length > 0 && (
                    <div>
                      <button
                        onClick={() => {
                          const newState = !placedSoundsCollapsed;
                          setPlacedSoundsCollapsed(newState);
                        }}
                        className="w-full flex items-center justify-between p-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded transition-colors"
                      >
                        <span>Placed on Grid</span>
                        <span className="text-xs text-slate-500">
                          {placedAssets.length} {placedAssets.length === 1 ? 'sound' : 'sounds'}
                        </span>
                        <span className="text-slate-500">
                          {placedSoundsCollapsed ? '▼' : '▲'}
                        </span>
                      </button>
                      {!placedSoundsCollapsed && (
                        <div className="space-y-2 mt-2">
                          {Object.entries(activeMapping.cells).map(([cellKey, sound]) => (
                            <PlacedSoundItem
                              key={`${cellKey}-${sound.id}`}
                              sound={sound}
                              cellKey={cellKey}
                              isSelected={selectedCellKey === cellKey}
                              onSelect={() => {
                                setSelectedCellKey(cellKey);
                                setSelectedSoundId(null);
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Center Panel (flex-1) - GridEditor (top) & Timeline (bottom) */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Top: GridEditor (flex-1, centered) */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-2 bg-slate-950 min-h-0">
              <div
                className="grid grid-cols-8 gap-2 bg-slate-900 p-4 rounded-xl shadow-2xl border border-slate-800"
                style={{
                  width: 'min(100%, 100vh - 150px)',
                  height: 'min(100%, 100vh - 150px)',
                  aspectRatio: '1'
                }}
              >
                {rows.map((row) => (
                  <React.Fragment key={`row-${row}`}>
                    {cols.map((col) => {
                      const key = cellKey(row, col);
                      const assignedSound = getCellSound(row, col);
                      const isOver = Boolean(activeId && overId === key);
                      const templateSlot = getTemplateSlot(row, col);

                      const cellKeyStr = cellKey(row, col);
                      const reachabilityLevel = reachabilityMap?.[cellKeyStr] || null;

                      // Get heatmap data from engineResult if heatmap overlay is enabled
                      let heatmapDifficulty: 'Easy' | 'Medium' | 'Hard' | 'Unplayable' | null = null;
                      let heatmapFinger: FingerID | null = null;
                      let heatmapHand: 'LH' | 'RH' | null = null;

                      if (showHeatmap && engineResult && filteredPerformance && filteredPerformance.events.length > 0 && assignedSound) {
                        // Find the debug event for this cell's note
                        const noteNumber = assignedSound?.originalMidiNote ?? null;
                        if (noteNumber !== null) {
                          // Find the worst-case event for this note
                          const noteEvents = engineResult.debugEvents.filter(e => e.noteNumber === noteNumber);
                          if (noteEvents.length > 0) {
                            const worstEvent = noteEvents.reduce((worst, current) => {
                              const worstRank = worst.difficulty === 'Unplayable' ? 3 :
                                worst.difficulty === 'Hard' ? 2 :
                                  worst.difficulty === 'Medium' ? 1 : 0;
                              const currentRank = current.difficulty === 'Unplayable' ? 3 :
                                current.difficulty === 'Hard' ? 2 :
                                  current.difficulty === 'Medium' ? 1 : 0;
                              return currentRank > worstRank ? current : worst;
                            }, noteEvents[0]);
                            heatmapDifficulty = worstEvent.difficulty;
                            // Type assertion: runtime data from runEngine uses FingerID (1-5), not FingerType
                            heatmapFinger = worstEvent.finger as FingerID | null;
                            // Type assertion: runtime data from runEngine uses 'LH'/'RH', but type says 'left'/'right'
                            const hand = worstEvent.assignedHand as 'left' | 'right' | 'Unplayable' | 'LH' | 'RH';
                            heatmapHand = hand === 'Unplayable' ? null : (hand === 'left' || hand === 'LH' ? 'LH' : 'RH');
                          }
                        }
                      }

                      const isHighlighted = false;
                      // Get finger constraint for this cell
                      const fingerConstraint = activeMapping?.fingerConstraints[cellKeyStr] || null;

                      return (
                        <DroppableCell
                          key={key}
                          row={row}
                          col={col}
                          assignedSound={assignedSound}
                          isOver={isOver}
                          isSelected={selectedCellKey === key}
                          isHighlighted={isHighlighted}
                          templateSlot={templateSlot}
                          reachabilityLevel={reachabilityLevel}
                          heatmapDifficulty={heatmapDifficulty}
                          heatmapFinger={heatmapFinger}
                          heatmapHand={heatmapHand}
                          fingerConstraint={fingerConstraint}
                          showNoteLabels={showNoteLabels}
                          instrumentConfig={instrumentConfig}
                          onClick={() => handleCellClick(row, col)}
                          onDoubleClick={() => handleCellDoubleClick(row, col)}
                          onContextMenu={(e) => handleCellContextMenu(e, row, col)}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Bottom: Performance Timeline - REMOVED: Now rendered in Workbench Dashboard section */}
            {/* Timeline is now displayed in the Dashboard section at the top of Workbench to avoid duplication */}
          </div>

          {/* Right Panel (w-80) - Sound Assignment Table Only */}
          <div className="w-80 flex-none border-l border-gray-700 bg-slate-900 flex flex-col overflow-hidden">
            <SoundAssignmentTable
              activeMapping={activeMapping}
              engineResult={engineResultProp}
            />
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu?.visible && (
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
                Cell: {contextMenu.targetCell}
              </div>

              <div className="px-2 py-1">
                <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">Reachability</div>
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
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 rounded"
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
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 rounded"
                >
                  Show Reach for R1
                </button>
              </div>

              {/* Finger Assignment Section */}
              {activeMapping && (
                <>
                  <div className="border-t border-slate-700 my-1" />
                  <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-700">
                    Assign Finger Lock
                  </div>

                  {/* Left Hand Fingers */}
                  <div className="px-2 py-1">
                    <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">Left Hand</div>
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
                            : 'text-slate-200 hover:bg-slate-700'
                            }`}
                        >
                          {isActive ? '✓ ' : ''}L{finger} ({fingerName})
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Hand Fingers */}
                  <div className="px-2 py-1">
                    <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">Right Hand</div>
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
                            : 'text-slate-200 hover:bg-slate-700'
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
                      <div className="border-t border-slate-700 my-1" />
                      <button
                        onClick={() => {
                          if (activeMapping) {
                            const newConstraints = { ...activeMapping.fingerConstraints };
                            delete newConstraints[contextMenu.targetCell];
                            onUpdateMapping({ fingerConstraints: newConstraints });
                          }
                          setContextMenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-slate-700 rounded"
                      >
                        Clear Finger Lock
                      </button>
                    </>
                  )}
                </>
              )}

              {activeMapping?.cells[contextMenu.targetCell] && (
                <>
                  <div className="border-t border-slate-700 my-1" />
                  <button
                    onClick={() => {
                      onRemoveSound(contextMenu.targetCell);
                      setContextMenu(null);
                      setSelectedCellKey(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-red-300 hover:bg-slate-700 rounded"
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
              className="p-3 rounded-md border bg-blue-600 border-blue-400 shadow-lg"
              style={{
                borderLeftWidth: '4px',
                borderLeftColor: draggedSound.color || '#6366f1',
              }}
            >
              <div className="font-medium text-white text-sm">
                {draggedSound.name}
              </div>
              <div className="text-xs text-blue-200 mt-1">
                {draggedSound.sourceType === 'midi_track' ? 'MIDI' : 'Audio'}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
      {showImportWizard && (
        <ImportWizard
          existingSounds={parkedSounds}
          onConfirm={handleImportConfirm}
          onCancel={handleImportCancel}
        />
      )}
    </DndContext>
  );
};

