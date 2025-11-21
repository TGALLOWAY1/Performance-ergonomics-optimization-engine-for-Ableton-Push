import React, { useState, useEffect, useRef } from 'react';
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
import { SoundAsset, GridMapping, cellKey, parseCellKey, TemplateId, LAYOUT_TEMPLATES, LayoutTemplate } from '../types/layout';
import { getReachabilityMap, ReachabilityLevel } from '../engine/feasibility';
import { GridPosition } from '../engine/gridMath';
import { FingerID } from '../types/engine';
import { parseMidiFile } from '../utils/midiImport';
import { InstrumentConfig, SectionMap } from '../data/models';
import { GridMapService } from '../engine/gridMapService';
import { mapToQuadrants } from '../utils/autoLayout';
import { saveProject, loadProject, exportLayout, importLayout } from '../utils/projectPersistence';
import { ProjectState, LayoutSnapshot } from '../types/projectState';
import { ImportWizard } from './ImportWizard';
import { runEngine } from '../engine/runEngine';
import { EngineResult } from '../engine/core';
import { TimelineArea } from './TimelineArea';
import { EngineResultsPanel } from './EngineResultsPanel';
import { SectionMapList } from './SectionMapList';

interface LayoutDesignerProps {
  /** Staging area for Voices before Assignment to Pads */
  parkedSounds: SoundAsset[];
  /** Currently active mapping being edited (defines Pad-to-Voice Assignments) */
  activeMapping: GridMapping | null;
  /** Instrument configuration for MIDI import (defines Cell-to-Pad mapping) */
  instrumentConfig: InstrumentConfig | null;
  /** Callback when a Voice is assigned to a Pad */
  onAssignSound: (cellKey: string, sound: SoundAsset) => void;
  /** Callback to assign multiple Voices to Pads at once (for batch operations) */
  onAssignSounds: (assignments: Record<string, SoundAsset>) => void;
  /** Callback when mapping metadata is updated */
  onUpdateMapping: (updates: Partial<GridMapping>) => void;
  /** Callback to duplicate the current mapping */
  onDuplicateMapping: () => void;
  /** Callback to add a new Voice to parkedSounds */
  onAddSound: (sound: SoundAsset) => void;
  /** Callback to update a Voice in parkedSounds */
  onUpdateSound: (soundId: string, updates: Partial<SoundAsset>) => void;
  /** Callback to update a Voice in the active mapping (Pad assignment) */
  onUpdateMappingSound: (cellKey: string, updates: Partial<SoundAsset>) => void;
  /** Callback to remove a Voice Assignment from a Pad */
  onRemoveSound: (cellKey: string) => void;
  /** Callback to delete a Voice from parkedSounds */
  onDeleteSound?: (soundId: string) => void;
  /** Current project state (for save/load operations) */
  projectState: ProjectState;
  /** Callback to update the entire project state */
  onUpdateProjectState: (state: ProjectState) => void;
  /** Callback to set the active mapping ID */
  onSetActiveMappingId?: (id: string) => void;
  /** Active layout for performance analysis */
  activeLayout: LayoutSnapshot | null;
  /** Callback to update section map */
  onUpdateSection?: (id: string, updates: Partial<SectionMap> | { field: 'startMeasure' | 'lengthInMeasures' | 'bottomLeftNote'; value: number }) => void;
  /** Callback to delete section map */
  onDeleteSection?: (id: string) => void;
  /** W1: Callback to create new instrument config */
  onCreateInstrumentConfig?: (config: Omit<InstrumentConfig, 'id'>) => void;
  /** W1: Callback to create new section map */
  onCreateSectionMap?: (sectionMap: Omit<SectionMap, 'id'>) => void;
  /** W1: Callback to update instrument config */
  onUpdateInstrumentConfig?: (id: string, updates: Partial<InstrumentConfig>) => void;
  /** W1: Callback to delete instrument config */
  onDeleteInstrumentConfig?: (id: string) => void;
  /** View Settings: Show Cell labels (MIDI note numbers) on Pads */
  showNoteLabels?: boolean;
  /** View Settings: View all steps (flatten time) */
  viewAllSteps?: boolean;
  /** View Settings: Show heatmap overlay */
  showHeatmap?: boolean;
}

// Draggable Voice Item Component (Voice can be assigned to a Pad)
interface DraggableSoundProps {
  sound: SoundAsset;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (updates: Partial<SoundAsset>) => void;
  onDelete: () => void;
}

const DraggableSound: React.FC<DraggableSoundProps> = ({ sound, isSelected, onSelect, onEdit, onDelete }) => {
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
            {/* Delete button - always visible */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete "${sound.name}" from staging?`)) {
                  onDelete();
                }
              }}
              className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
              title="Delete sound"
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
  sound: SoundAsset;
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
  assignedSound: SoundAsset | null;
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
  reachabilityLevel,
  heatmapDifficulty,
  heatmapFinger,
  heatmapHand,
  fingerConstraint,
  showNoteLabels = false,
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
      }
    : undefined;

  // Combine refs for both droppable and draggable
  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    if (assignedSound && node) {
      setDragRef(node);
    }
  };

  return (
    <div
      ref={combinedRef}
      onClick={(e) => {
        // Only fire if not dragging - activation constraint (5px) should prevent drag from starting on clicks
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
        w-16 h-16 flex flex-col items-center justify-center rounded-md
        border transition-all duration-100 relative
        ${isHighlighted ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-slate-900 z-20' : ''}
        ${assignedSound
          ? isSelected
            ? 'bg-blue-900/50 border-blue-400 border-2 cursor-grab active:cursor-grabbing'
            : isDragging
            ? 'bg-blue-600 border-blue-400 opacity-50 cursor-grabbing'
            : 'bg-slate-700 border-slate-600 cursor-grab active:cursor-grabbing'
          : isDroppableOver || isOver
          ? 'bg-slate-800 border-blue-500 border-dashed border-2 cursor-pointer'
          : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-600 cursor-pointer'
        }
      `}
      style={{
        ...dragStyle,
        borderLeftWidth: assignedSound ? '4px' : undefined,
        borderLeftColor: assignedSound?.color || undefined,
        // Apply heatmap overlay if enabled (behind the sound chip)
        ...(heatmapDifficulty && assignedSound ? {
          backgroundColor: heatmapDifficulty === 'Unplayable'
            ? 'rgba(239, 68, 68, 0.3)'
            : heatmapDifficulty === 'Hard'
            ? 'rgba(249, 115, 22, 0.3)'
            : heatmapDifficulty === 'Medium'
            ? 'rgba(234, 179, 8, 0.3)'
            : 'rgba(59, 130, 246, 0.2)',
          borderColor: heatmapDifficulty === 'Unplayable'
            ? 'rgba(239, 68, 68, 0.6)'
            : heatmapDifficulty === 'Hard'
            ? 'rgba(249, 115, 22, 0.6)'
            : heatmapDifficulty === 'Medium'
            ? 'rgba(234, 179, 8, 0.6)'
            : 'rgba(59, 130, 246, 0.4)',
          borderWidth: heatmapDifficulty === 'Unplayable' || heatmapDifficulty === 'Hard' ? '3px' : '2px',
        } : {}),
        // Apply reachability overlay for empty cells
        ...(reachabilityLevel && !assignedSound ? {
          backgroundColor: reachabilityLevel === 'green' 
            ? 'rgba(34, 197, 94, 0.25)' 
            : reachabilityLevel === 'yellow'
            ? 'rgba(234, 179, 8, 0.25)'
            : 'rgba(107, 114, 128, 0.3)',
          borderColor: reachabilityLevel === 'green'
            ? 'rgba(34, 197, 94, 0.5)'
            : reachabilityLevel === 'yellow'
            ? 'rgba(234, 179, 8, 0.5)'
            : 'rgba(107, 114, 128, 0.4)',
        } : {}),
      }}
    >
      {assignedSound ? (
        <>
          <span className="text-xs font-semibold text-slate-200">
            {assignedSound.name}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">
            [{row},{col}]
          </span>
          {/* Note Label - Show MIDI pitch when showNoteLabels is enabled */}
          {showNoteLabels && noteNumber !== null && (
            <div className="absolute bottom-1 left-0 right-0 flex flex-col items-center text-[9px] opacity-60 leading-tight pointer-events-none font-mono">
              <span>{noteNumber}</span>
              <span>{getNoteName(noteNumber)}</span>
            </div>
          )}
          {/* Finger Badge - Always show when available from engine */}
          {heatmapFinger && heatmapHand && (
            <div className={`
              absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm z-10
              ${heatmapHand === 'LH' ? 'bg-blue-200 text-blue-900' : 'bg-red-200 text-red-900'}
            `}>
              {heatmapHand === 'LH' ? 'L' : 'R'}{heatmapFinger}
            </div>
          )}
          {/* Finger Constraint Lock Icon - Show when constraint exists */}
          {fingerConstraint && (
            <div className="absolute top-1 left-1 flex items-center gap-1 bg-slate-800/90 border border-slate-600 rounded px-1 py-0.5 z-10">
              <span className="text-[10px]">🔒</span>
              <span className="text-[10px] font-semibold text-slate-200">{fingerConstraint}</span>
            </div>
          )}
        </>
      ) : (
        <>
          {templateSlot ? (
            <>
              <span className="text-[10px] font-medium text-slate-500/60">
                {templateSlot.label}
              </span>
              {templateSlot.suggestedNote !== undefined && (
                <span className="text-[8px] text-slate-600/50 mt-0.5">
                  {templateSlot.suggestedNote}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-slate-500">
              [{row},{col}]
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
  onUpdateSection,
  onDeleteSection,
  onCreateInstrumentConfig,
  onCreateSectionMap,
  onUpdateInstrumentConfig,
  onDeleteInstrumentConfig,
  showNoteLabels = false,
  viewAllSteps = false,
  showHeatmap = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const loadProjectInputRef = useRef<HTMLInputElement>(null);
  const importLayoutInputRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedSound, setDraggedSound] = useState<SoundAsset | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('none');
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const [stagingAreaCollapsed, setStagingAreaCollapsed] = useState(false);
  const [placedSoundsCollapsed, setPlacedSoundsCollapsed] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  // View Settings are now passed as props from Workbench
  // Keep local state for backward compatibility if needed, but use props
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [timelineForceVisible, setTimelineForceVisible] = useState(false);
  const [timelineAutoHidden, setTimelineAutoHidden] = useState(false);
  const [engineResult, setEngineResult] = useState<EngineResult | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedCell, setHighlightedCell] = useState<{ row: number; col: number } | null>(null);
  const [leftPanelTab, setLeftPanelTab] = useState<'library' | 'sections'>('library');
  const timelineContainerRef = useRef<HTMLDivElement>(null);
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
    let sound: SoundAsset | null = null;
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
        const newCells: Record<string, SoundAsset> = {};
        
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
  const getCellSound = (row: number, col: number): SoundAsset | null => {
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
    const newSound: SoundAsset = {
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

  // Handle MIDI file import
  const handleMidiFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !instrumentConfig) {
      event.target.value = '';
      return;
    }

    try {
      // W3: Get import result with unmapped note count
      const importResult = await parseMidiFile(file, instrumentConfig);
      const performance = importResult.performance;
      
      // Intelligent Root Note Logic: Auto-set bottomLeftNote to minimum note
      if (importResult.minNoteNumber !== null && onUpdateSection && projectState.sectionMaps.length > 0) {
        const activeSection = projectState.sectionMaps[0]; // Single Static Section model
        onUpdateSection(activeSection.id, { 
          field: 'bottomLeftNote', 
          value: importResult.minNoteNumber 
        });
      }
      
      // W3: Show warning if there are unmapped notes (should be 0 after auto-adjustment)
      if (importResult.unmappedNoteCount > 0) {
        console.warn(
          `Warning: ${importResult.unmappedNoteCount} note${importResult.unmappedNoteCount === 1 ? '' : 's'} in the MIDI file fall outside the 8x8 grid window. ` +
          `Root note auto-adjusted to ${importResult.minNoteNumber !== null ? importResult.minNoteNumber : instrumentConfig.bottomLeftNote} to fit all notes.`
        );
      }
      
      // Extract unique note numbers from the performance
      const uniqueNotes = new Set<number>();
      performance.events.forEach(event => {
        uniqueNotes.add(event.noteNumber);
      });

      // Create SoundAssets for each unique note
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const getNoteName = (midiNote: number): string => {
        const note = noteNames[midiNote % 12];
        // MIDI note 0 = C-2, so octave = floor(0/12) - 2 = -2
        const octave = Math.floor(midiNote / 12) - 2;
        return `${note}${octave}`;
      };

      // Generate colors for each note (distinct colors)
      const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
        '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
        '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
      ];

      // Check for existing sounds to avoid duplicates
      const existingNoteMap = new Map<number, SoundAsset>();
      parkedSounds.forEach(sound => {
        if (sound.originalMidiNote !== null) {
          existingNoteMap.set(sound.originalMidiNote, sound);
        }
      });

      const newSounds: SoundAsset[] = [];
      Array.from(uniqueNotes).forEach((noteNumber, index) => {
        // Check if a sound for this note already exists
        const existing = existingNoteMap.get(noteNumber);
        if (existing) {
          // Use existing sound instead of creating a duplicate
          newSounds.push(existing);
        } else {
          // Create new sound
          const noteName = getNoteName(noteNumber);
          const newSound: SoundAsset = {
            id: `sound-${file.name}-${noteNumber}-${Date.now()}-${index}`,
            name: `${noteName} (${noteNumber})`,
            sourceType: 'midi_track' as const,
            sourceFile: file.name,
            originalMidiNote: noteNumber,
            color: colors[index % colors.length],
          };
          newSounds.push(newSound);
          // Add to library only if it's new
          onAddSound(newSound);
        }
      });

      // Automatically populate the grid based on Cell (MIDI note numbers)
      if (instrumentConfig) {
        // Assignment: Map each Voice to its Pad position based on its Cell (MIDI note number)
        const assignments: Array<{ cellKey: string; sound: SoundAsset }> = [];
        
        newSounds.forEach(sound => {
          if (sound.originalMidiNote !== null) {
            const position = GridMapService.getPositionForNote(sound.originalMidiNote, instrumentConfig);
            if (position) {
              const cellKeyStr = cellKey(position.row, position.col);
              assignments.push({ cellKey: cellKeyStr, sound });
              console.log(`Assignment: Cell ${sound.originalMidiNote} (Voice: ${sound.name}) -> Pad [${position.row},${position.col}]`);
            } else {
              console.warn(`Cell ${sound.originalMidiNote} (Voice: ${sound.name}) is outside grid bounds (bottomLeftNote: ${instrumentConfig.bottomLeftNote})`);
            }
          }
        });

        // Batch all assignments together to avoid state update conflicts
        if (assignments.length > 0) {
          const cellsToAssign: Record<string, SoundAsset> = {};
          assignments.forEach(({ cellKey, sound }) => {
            cellsToAssign[cellKey] = sound;
          });

          // Use batch assignment if available, otherwise fall back to individual calls
          if (onAssignSounds) {
            onAssignSounds(cellsToAssign);
          } else {
            // Fallback: assign individually (may have race conditions)
            assignments.forEach(({ cellKey, sound }) => {
              onAssignSound(cellKey, sound);
            });
          }

          // Update mapping metadata
          if (!activeMapping) {
            // Wait for mapping to be created, then update metadata
            setTimeout(() => {
              onUpdateMapping({
                name: `${performance.name || file.name} Layout`,
                notes: `Auto-generated from ${file.name}`,
              });
            }, 50);
          } else {
            onUpdateMapping({
              notes: activeMapping.notes 
                ? `${activeMapping.notes}\n\nAuto-populated from ${file.name}`
                : `Auto-populated from ${file.name}`,
            });
          }
        }
      }

      // Reset file input
      event.target.value = '';
    } catch (err) {
      console.error('Failed to import MIDI file:', err);
      alert(`Failed to import MIDI file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      event.target.value = '';
    }
  };

  // Handle scan MIDI button click - show ImportWizard
  const handleScanMidiClick = () => {
    setShowImportWizard(true);
  };

  // Handle ImportWizard confirm - add assets to parkedSounds
  const handleImportConfirm = (assets: SoundAsset[]) => {
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

  // Handle save project
  const handleSaveProject = () => {
    saveProject(projectState);
  };

  // Handle load project
  const handleLoadProjectClick = () => {
    if (loadProjectInputRef.current) {
      loadProjectInputRef.current.click();
    }
  };

  const handleLoadProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = '';
      return;
    }

    try {
      const loadedState = await loadProject(file);
      onUpdateProjectState(loadedState);
      event.target.value = '';
    } catch (err) {
      console.error('Failed to load project:', err);
      alert(`Failed to load project: ${err instanceof Error ? err.message : 'Unknown error'}`);
      event.target.value = '';
    }
  };

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save project
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProject(projectState);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectState]); // Include projectState in deps to ensure latest state is saved

  // Handle auto-layout to quadrants
  const handleMapToQuadrants = () => {
    if (!instrumentConfig) {
      alert('No instrument configuration available. Cannot perform auto-layout.');
      return;
    }

    // Collect all sounds that have originalMidiNote set
    // Use derived lists to avoid duplicates
    const soundsWithNotes: SoundAsset[] = [
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
    const assignments: Record<string, SoundAsset> = {};
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

  // Real-time engine execution: Run whenever activeMapping or activeLayout.performance changes
  useEffect(() => {
    if (!activeMapping || !activeLayout) {
      setEngineResult(null);
      return;
    }

    // Debounce engine execution for performance
    const timer = setTimeout(() => {
      const basicResult = runEngine(activeLayout.performance, activeMapping);
      // Adapter: Convert basic EngineResult to extended EngineResult expected by EngineResultsPanel
      // EngineResultsPanel handles missing fields gracefully, so we use type assertion
      const extendedResult: EngineResult = {
        ...basicResult,
        fingerUsageStats: {},
        fatigueMap: {},
        averageDrift: 0,
      } as EngineResult;
      setEngineResult(extendedResult);
      
      // Update scoreCache in the mapping
      onUpdateMapping({ scoreCache: basicResult.score });
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [activeMapping, activeLayout?.performance, onUpdateMapping]);

  // Responsive timeline hiding: Hide if container height < 200px or window width < 768px
  useEffect(() => {
    const checkTimelineVisibility = () => {
      if (!timelineContainerRef.current) return;

      const container = timelineContainerRef.current;
      const containerHeight = container.clientHeight;
      const windowWidth = window.innerWidth;
      
      const shouldHide = (containerHeight < 200 || windowWidth < 768) && !timelineForceVisible;
      setTimelineAutoHidden(shouldHide);
    };

    checkTimelineVisibility();
    
    const resizeObserver = new ResizeObserver(checkTimelineVisibility);
    if (timelineContainerRef.current) {
      resizeObserver.observe(timelineContainerRef.current);
    }

    window.addEventListener('resize', checkTimelineVisibility);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkTimelineVisibility);
    };
  }, [timelineForceVisible]);

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
        {/* Header with View Settings Toolbar */}
        <div className="flex-none border-b border-gray-700 bg-slate-800 px-4 py-2">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-slate-200">Layout Designer</h1>
            <div className="flex items-center gap-4">
              {/* View Settings */}
              <div className="flex items-center gap-4 border border-slate-700 rounded px-3 py-1.5">
                <span className="text-xs text-slate-400 font-semibold">View Settings:</span>
                
                {/* Root Note */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Root Note:</label>
                  <input
                    type="number"
                    value={instrumentConfig?.bottomLeftNote ?? 0}
                    onChange={(e) => {
                      if (onUpdateSection && projectState.sectionMaps[0]) {
                        onUpdateSection(projectState.sectionMaps[0].id, { field: 'bottomLeftNote', value: parseInt(e.target.value) || 0 });
                      }
                    }}
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                  />
                </div>
                
                <div className="h-4 w-px bg-slate-700" />
                
                {/* View Settings are now controlled from Workbench header */}
                <span className="text-xs text-slate-500 italic">View Settings controlled from main header</span>
              </div>
              
              <div className="h-6 w-px bg-slate-700" />
              
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
              
              <div className="flex items-center gap-2">
                <div className="flex gap-1 border border-slate-700 rounded p-1">
                  <button
                    onClick={handleSaveProject}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    title="Save Project (Ctrl/Cmd+S)"
                  >
                    Save Project
                  </button>
                  <button
                    onClick={handleLoadProjectClick}
                    className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
                    title="Load Project"
                  >
                    Load Project
                  </button>
                  <input
                    ref={loadProjectInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleLoadProject}
                    className="hidden"
                  />
                </div>
                <div className="flex gap-1 border border-slate-700 rounded p-1">
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
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    leftPanelTab === 'library'
                      ? 'bg-slate-800 text-slate-200 border-b-2 border-blue-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  Library
                </button>
                <button
                  onClick={() => setLeftPanelTab('sections')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    leftPanelTab === 'sections'
                      ? 'bg-slate-800 text-slate-200 border-b-2 border-blue-500'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  Sections
                </button>
              </div>
            </div>
            
            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {leftPanelTab === 'library' ? (
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
                      />
                    </div>
                  </div>
            
            <div className="space-y-4">
              {/* Detected Voices Section (formerly Staging Area) */}
              <div>
                <button
                  onClick={() => setStagingAreaCollapsed(!stagingAreaCollapsed)}
                  className="w-full flex items-center justify-between p-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded transition-colors"
                >
                  <span>Detected Voices</span>
                  <span className="text-xs text-slate-500">
                    {stagingAssets.length} {stagingAssets.length === 1 ? 'voice' : 'voices'}
                  </span>
                  <span className="text-slate-500">
                    {stagingAreaCollapsed ? '▼' : '▲'}
                  </span>
                </button>
                {!stagingAreaCollapsed && (
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
                          No Voices detected
                          <br />
                          <span className="text-xs">Click "+ New" or "Import MIDI" to add Voices</span>
                          <br />
                          <span className="text-xs">Or drag Voices from grid here to unassign</span>
                        </div>
                      ) : (
                        stagingAssets.map((sound) => (
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
                          />
                        ))
                      )}
                    </div>
                  </DroppableStagingArea>
                )}
              </div>

              {/* Placed on Grid Section */}
              {activeMapping && Object.keys(activeMapping.cells).length > 0 && (
                <div>
                  <button
                    onClick={() => setPlacedSoundsCollapsed(!placedSoundsCollapsed)}
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
              ) : (
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-slate-200 mb-4">Section Maps</h2>
                  <SectionMapList
                    sectionMaps={projectState.sectionMaps}
                    instrumentConfigs={projectState.instrumentConfigs}
                    onUpdateSection={onUpdateSection || (() => {})}
                    onDeleteSection={onDeleteSection}
                    onCreateInstrumentConfig={onCreateInstrumentConfig}
                    onCreateSectionMap={onCreateSectionMap}
                    onUpdateInstrumentConfig={onUpdateInstrumentConfig}
                    onDeleteInstrumentConfig={onDeleteInstrumentConfig}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Center Panel (flex-1) - GridEditor (top) & Timeline (bottom) */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Top: GridEditor (flex-1, centered) */}
            <div className="flex-1 flex items-center justify-center overflow-auto p-8 bg-slate-950 min-h-0">
              <div
                className="grid grid-cols-8 gap-2 bg-slate-900 p-4 rounded-xl shadow-2xl border border-slate-800"
                style={{ width: 'fit-content' }}
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
                  
                  if (showHeatmap && engineResult && activeLayout && activeLayout.performance.events.length > 0 && assignedSound) {
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

                  const isHighlighted = highlightedCell?.row === row && highlightedCell?.col === col;
                  
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
            
            {/* Bottom: Performance Timeline (h-64, fixed height, collapsible) */}
            <div 
              ref={timelineContainerRef}
              className={`flex-none border-t border-gray-700 bg-slate-900 transition-all duration-200 ${
                timelineCollapsed || (timelineAutoHidden && !timelineForceVisible) ? 'h-12' : 'h-64'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300">Performance Timeline</h3>
                <div className="flex items-center gap-2">
                  {timelineAutoHidden && (
                    <button
                      onClick={() => setTimelineForceVisible(!timelineForceVisible)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded bg-blue-900/20 hover:bg-blue-900/30"
                      title={timelineForceVisible ? 'Auto-hide Timeline' : 'Show Timeline'}
                    >
                      {timelineForceVisible ? 'Auto-hide' : 'Show Timeline'}
                    </button>
                  )}
                  <button
                    onClick={() => setTimelineCollapsed(!timelineCollapsed)}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {timelineCollapsed ? '▼ Expand' : '▲ Collapse'}
                  </button>
                </div>
              </div>
              {!timelineCollapsed && (!timelineAutoHidden || timelineForceVisible) && activeLayout && (
                <div className="h-[calc(100%-3rem)]">
                  <TimelineArea
                    steps={(() => {
                      // Calculate steps from performance: find the latest event time and convert to 16th notes
                      // Default to 64 steps (4 bars) if empty or short
                      if (activeLayout.performance.events.length === 0) {
                        return 64; // Default to 4 measures
                      }
                      const tempo = activeLayout.performance.tempo || 120;
                      const stepDuration = (60 / tempo) / 4; // 16th note duration in seconds
                      const latestEvent = activeLayout.performance.events.reduce((latest, event) => 
                        event.startTime > latest.startTime ? event : latest
                      );
                      const eventEndTime = latestEvent.startTime + (latestEvent.duration || stepDuration);
                      const maxStep = Math.ceil(eventEndTime / stepDuration);
                      return Math.max(64, Math.ceil(maxStep / 16) * 16); // Round up to nearest measure (16 steps), minimum 64
                    })()}
                    currentStep={currentStep}
                    onStepSelect={setCurrentStep}
                    sectionMaps={projectState.sectionMaps}
                    viewAllSteps={viewAllSteps}
                    onUpdateSectionMeasure={(id, field, value) => {
                      if (onUpdateSection) {
                        onUpdateSection(id, { field, value });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Panel (w-80) - Split: Metadata (Top 50%) and Ergonomic Score (Bottom 50%) */}
          <div className="w-80 flex-none border-l border-gray-700 bg-slate-900 flex flex-col overflow-hidden">
            {/* Top Half (50%) - Layout Metadata */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="p-4">
              <h2 className="text-lg font-semibold text-slate-200 mb-4">
                Layout Metadata
              </h2>

            <div className="space-y-4">
              {/* Template Dropdown */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Templates
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value as TemplateId)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="none">None</option>
                  {LAYOUT_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {selectedTemplate !== 'none' && (
                  <p className="mt-1 text-xs text-slate-400">
                    Template guides will show on the grid. Sounds will snap to template slots when dropped nearby.
                  </p>
                )}
              </div>

              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={activeMapping?.name || ''}
                  onChange={(e) => onUpdateMapping({ name: e.target.value })}
                  placeholder="Layout name..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Notes Field */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={activeMapping?.notes || ''}
                  onChange={(e) => onUpdateMapping({ notes: e.target.value })}
                  placeholder="Add notes about this layout..."
                  rows={6}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Selected Sound Properties */}
              {selectedSound && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">
                    {selectedCellKey ? 'Placed Sound' : 'Library Sound'}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Name
                      </label>
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={selectedSound.name}
                        onChange={(e) => {
                          if (selectedCellKey) {
                            onUpdateMappingSound(selectedCellKey, { name: e.target.value });
                          } else {
                            onUpdateSound(selectedSound.id, { name: e.target.value });
                          }
                        }}
                        className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedSound.color || '#6366f1'}
                          onChange={(e) => {
                            if (selectedCellKey) {
                              onUpdateMappingSound(selectedCellKey, { color: e.target.value });
                            } else {
                              onUpdateSound(selectedSound.id, { color: e.target.value });
                            }
                          }}
                          className="w-12 h-8 rounded border border-slate-700 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={selectedSound.color || '#6366f1'}
                          onChange={(e) => {
                            if (selectedCellKey) {
                              onUpdateMappingSound(selectedCellKey, { color: e.target.value });
                            } else {
                              onUpdateSound(selectedSound.id, { color: e.target.value });
                            }
                          }}
                          className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono"
                        />
                      </div>
                    </div>
                    {/* Source Info (Read-only) */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Source Info
                      </label>
                      <div className="px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700 rounded text-slate-400 space-y-1">
                        <div>
                          <span className="text-slate-500">Type:</span> {selectedSound.sourceType === 'midi_track' ? 'MIDI Track' : 'Audio Slice'}
                        </div>
                        {selectedSound.sourceFile && (
                          <div>
                            <span className="text-slate-500">File:</span> {selectedSound.sourceFile}
                          </div>
                        )}
                        {selectedSound.originalMidiNote !== null && (
                          <div>
                            <span className="text-slate-500">Original Note:</span> {selectedSound.originalMidiNote}
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedCellKey && (
                      <button
                        onClick={() => {
                          onRemoveSound(selectedCellKey);
                          setSelectedCellKey(null);
                        }}
                        className="w-full px-3 py-1.5 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded border border-red-900/50"
                      >
                        Remove from Grid
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Reachability Info Badge */}
              {reachabilityConfig && (
                <div className="mt-4 pt-4 border-t border-slate-700">
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
                    onClick={() => setReachabilityConfig(null)}
                    className="mt-2 w-full px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Info Section */}
              {activeMapping && (
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <div className="text-xs text-slate-400 space-y-1">
                    <div>
                      <span className="text-slate-500">ID:</span>{' '}
                      <span className="font-mono">{activeMapping.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Cells assigned:</span>{' '}
                      {Object.keys(activeMapping.cells).length} / 64
                    </div>
                    {activeMapping.scoreCache !== null && (
                      <div>
                        <span className="text-slate-500">Score:</span>{' '}
                        {activeMapping.scoreCache.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              )}
              </div>
            </div>

            {/* Bottom Half (50%) - Ergonomic Score */}
            <div className="flex-1 border-t border-slate-700 overflow-y-auto min-h-0">
              <EngineResultsPanel
                result={engineResult}
                activeMapping={activeMapping}
                onHighlightCell={(row, col) => {
                  setHighlightedCell({ row, col });
                  // Clear highlight after 3 seconds
                  setTimeout(() => setHighlightedCell(null), 3000);
                }}
              />
            </div>
          </div>
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
                        className={`w-full text-left px-3 py-1.5 text-sm rounded ${
                          isActive
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
                        className={`w-full text-left px-3 py-1.5 text-sm rounded ${
                          isActive
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

