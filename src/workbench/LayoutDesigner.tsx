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
import { InstrumentConfig } from '../types/performance';
import { GridMapService } from '../engine/gridMapService';
import { mapToQuadrants } from '../utils/autoLayout';
import { saveProject, loadProject, exportLayout, importLayout } from '../utils/projectPersistence';
import { ProjectState } from '../types/projectState';
import { ImportWizard } from './ImportWizard';

interface LayoutDesignerProps {
  /** Staging area for sound assets before assignment to grid */
  parkedSounds: SoundAsset[];
  /** Currently active mapping being edited */
  activeMapping: GridMapping | null;
  /** Instrument configuration for MIDI import */
  instrumentConfig: InstrumentConfig | null;
  /** Callback when a sound is dropped on a grid cell */
  onAssignSound: (cellKey: string, sound: SoundAsset) => void;
  /** Callback to assign multiple sounds at once (for batch operations) */
  onAssignSounds: (assignments: Record<string, SoundAsset>) => void;
  /** Callback when mapping metadata is updated */
  onUpdateMapping: (updates: Partial<GridMapping>) => void;
  /** Callback to duplicate the current mapping */
  onDuplicateMapping: () => void;
  /** Callback to add a new sound to parkedSounds */
  onAddSound: (sound: SoundAsset) => void;
  /** Callback to update a sound in parkedSounds */
  onUpdateSound: (soundId: string, updates: Partial<SoundAsset>) => void;
  /** Callback to update a sound in the active mapping */
  onUpdateMappingSound: (cellKey: string, updates: Partial<SoundAsset>) => void;
  /** Callback to remove a sound from a cell */
  onRemoveSound: (cellKey: string) => void;
  /** Current project state (for save/load operations) */
  projectState: ProjectState;
  /** Callback to update the entire project state */
  onUpdateProjectState: (state: ProjectState) => void;
  /** Callback to set the active mapping ID */
  onSetActiveMappingId?: (id: string) => void;
}

// Draggable Sound Item Component
interface DraggableSoundProps {
  sound: SoundAsset;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (updates: Partial<SoundAsset>) => void;
}

const DraggableSound: React.FC<DraggableSoundProps> = ({ sound, isSelected, onSelect, onEdit }) => {
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
          <div className="font-medium text-slate-200 text-sm">
            {sound.name}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {sound.sourceType === 'midi_track' ? 'MIDI' : 'Audio'}
            {sound.originalMidiNote !== null && ` • Note ${sound.originalMidiNote}`}
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

// Placed Sound Item Component (for Library "Placed on Grid" section)
interface PlacedSoundItemProps {
  sound: SoundAsset;
  cellKey: string;
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

// Droppable Grid Cell Component
interface DroppableCellProps {
  row: number;
  col: number;
  assignedSound: SoundAsset | null;
  isOver: boolean;
  isSelected: boolean;
  templateSlot: { label: string; suggestedNote?: number } | null;
  reachabilityLevel: ReachabilityLevel | null;
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
  templateSlot,
  reachabilityLevel,
  onClick,
  onDoubleClick,
  onContextMenu,
}) => {
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
  projectState,
  onUpdateProjectState,
  onSetActiveMappingId,
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

      // If moving from one cell to another, remove from source first
      if (sourceCellKey && sourceCellKey !== targetCellKey) {
        // Update reachability config if the anchor cell is being moved
        if (reachabilityConfig && reachabilityConfig.anchorCellKey === sourceCellKey) {
          const newParsed = parseCellKey(targetCellKey);
          if (newParsed) {
            setReachabilityConfig({
              ...reachabilityConfig,
              anchorCellKey: targetCellKey,
              anchorPos: { row: newParsed.row, col: newParsed.col },
            });
          }
        }
        onRemoveSound(sourceCellKey);
      }

      onAssignSound(targetCellKey, sound);
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
      const performance = await parseMidiFile(file, instrumentConfig);
      
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

      // Automatically populate the grid based on MIDI note numbers
      if (instrumentConfig) {
        // Map each sound to its grid position based on MIDI note number
        const assignments: Array<{ cellKey: string; sound: SoundAsset }> = [];
        
        newSounds.forEach(sound => {
          if (sound.originalMidiNote !== null) {
            const position = GridMapService.getPositionForNote(sound.originalMidiNote, instrumentConfig);
            if (position) {
              const cellKeyStr = cellKey(position.row, position.col);
              assignments.push({ cellKey: cellKeyStr, sound });
              console.log(`Mapping note ${sound.originalMidiNote} (${sound.name}) to grid [${position.row},${position.col}]`);
            } else {
              console.warn(`Note ${sound.originalMidiNote} (${sound.name}) is outside grid bounds (bottomLeftNote: ${instrumentConfig.bottomLeftNote})`);
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

  // Handle clear grid
  const handleClearGrid = () => {
    if (!activeMapping) {
      return; // Nothing to clear
    }

    if (window.confirm('Are you sure you want to clear all sounds from the grid? This cannot be undone.')) {
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
        {/* Header with File Menu */}
        <div className="flex-none border-b border-gray-700 bg-slate-800 px-4 py-2">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-slate-200">Layout Designer</h1>
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

        {/* Main Content Area */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Left Panel - Library */}
          <div className="w-64 flex-none border-r border-gray-700 bg-slate-900 overflow-y-auto">
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
              {/* Staging Area Section */}
              <div>
                <button
                  onClick={() => setStagingAreaCollapsed(!stagingAreaCollapsed)}
                  className="w-full flex items-center justify-between p-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded transition-colors"
                >
                  <span>Staging Area</span>
                  <span className="text-xs text-slate-500">
                    {stagingAssets.length} {stagingAssets.length === 1 ? 'sound' : 'sounds'}
                  </span>
                  <span className="text-slate-500">
                    {stagingAreaCollapsed ? '▼' : '▲'}
                  </span>
                </button>
                {!stagingAreaCollapsed && (
                  <DroppableStagingArea>
                    <div className="space-y-2 mt-2">
                      {stagingAssets.length === 0 ? (
                        <div className="text-sm text-slate-500 text-center py-8 border-2 border-dashed border-slate-700 rounded">
                          No sounds in staging
                          <br />
                          <span className="text-xs">Click "+ New" or "Import MIDI" to add sounds</span>
                          <br />
                          <span className="text-xs">Or drag sounds from grid here to unassign</span>
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
        </div>

        {/* Center Panel - Grid */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-8 bg-slate-950">
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

                  return (
                    <DroppableCell
                      key={key}
                      row={row}
                      col={col}
                      assignedSound={assignedSound}
                      isOver={isOver}
                      isSelected={selectedCellKey === key}
                      templateSlot={templateSlot}
                      reachabilityLevel={reachabilityLevel}
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

        {/* Right Panel - Metadata */}
        <div className="w-80 flex-none border-l border-gray-700 bg-slate-900 overflow-y-auto">
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

              {/* Auto-Layout Section */}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">
                  Auto-Layout
                </h3>
                <button
                  onClick={handleMapToQuadrants}
                  disabled={!instrumentConfig}
                  className="w-full px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-200 rounded border border-purple-600 disabled:border-slate-600 transition-colors font-medium"
                  title={!instrumentConfig ? 'No instrument config available' : 'Rearrange sounds into 4x4 quadrants based on MIDI note banks'}
                >
                  Auto-Layout: 4x4 Quadrants
                </button>
                <p className="mt-2 text-xs text-slate-400">
                  Groups sounds into banks of 16 and maps each bank to a 4x4 quadrant. This will change grid positions and exported MIDI notes.
                </p>
              </div>

              {/* Actions Section */}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">
                  Actions
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={onDuplicateMapping}
                    className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded border border-slate-600 transition-colors font-medium"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={handleClearGrid}
                    disabled={!activeMapping || Object.keys(activeMapping.cells).length === 0}
                    className="w-full px-4 py-2 bg-red-900/30 hover:bg-red-900/50 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-red-300 disabled:text-slate-500 rounded border border-red-900/50 disabled:border-slate-600 transition-colors font-medium"
                    title={!activeMapping || Object.keys(activeMapping.cells).length === 0 ? 'No cells to clear' : 'Remove all sounds from the grid'}
                  >
                    Clear Grid
                  </button>
                </div>
              </div>

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
              className="w-full text-left px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-700 rounded"
            >
              Clear Constraints
            </button>
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

