import React, { useState, useEffect, useRef } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Voice, GridMapping, parseCellKey } from '../types/layout';
import { InstrumentConfig } from '../types/performance';
import { getRawActivePerformance } from '../utils/performanceSelectors';
import { ProjectState } from '../types/projectState';

// ------------------------------------------------------------------
// Draggable Voice Item Component
// ------------------------------------------------------------------
export interface DraggableSoundProps {
    sound: Voice;
    isSelected: boolean;
    onSelect: () => void;
    onEdit: (updates: Partial<Voice>) => void;
    onDelete: () => void;
    isVisible?: boolean;
    onToggleVisibility?: (noteNumber: number) => void;
}

export const DraggableSound: React.FC<DraggableSoundProps> = ({
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
                    ? 'bg-[var(--finger-L1)] border-[var(--finger-L2)] shadow-lg scale-105 opacity-50 cursor-grabbing'
                    : isEditing
                        ? 'bg-[var(--bg-card)] border-[var(--finger-L1)] cursor-default'
                        : isSelected
                            ? 'bg-[var(--bg-card)] border-[var(--finger-L1)] cursor-pointer'
                            : 'bg-[var(--bg-panel)] border-[var(--border-subtle)] hover:bg-[var(--bg-card)] hover:border-[var(--text-secondary)] cursor-grab active:cursor-grabbing'
                }
      `}
            style={{
                ...style,
                borderLeftWidth: '4px',
                borderLeftColor: sound.color || 'var(--finger-L1)',
            }}
        >
            {isEditing ? (
                <div className="space-y-2">
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1 text-sm bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)]"
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
                            className="w-8 h-8 rounded border border-[var(--border-subtle)] cursor-pointer"
                        />
                        <button
                            onClick={handleSave}
                            className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                            Save
                        </button>
                        <button
                            onClick={handleCancel}
                            className="px-2 py-1 text-xs bg-[var(--bg-input)] hover:bg-[var(--bg-card)] text-white rounded"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-[var(--text-primary)] text-sm">
                                {sound.name}
                            </div>
                            <div className="text-xs text-[var(--text-secondary)] mt-1">
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
                                        ? 'text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-panel)]'
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
                                className="flex-shrink-0 p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-warning)] hover:bg-[var(--bg-panel)] rounded transition-colors"
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
                            className="mt-2 w-full px-2 py-1 text-xs bg-[var(--bg-input)] hover:bg-[var(--bg-panel)] text-[var(--text-primary)] rounded"
                        >
                            Edit
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

// ------------------------------------------------------------------
// Placed Voice Item Component
// ------------------------------------------------------------------
export interface PlacedSoundItemProps {
    sound: Voice;
    cellKey: string; // Pad key "row,col"
    isSelected: boolean;
    onSelect: () => void;
    onUpdateSound?: (updates: Partial<Voice>) => void;
}

export const PlacedSoundItem: React.FC<PlacedSoundItemProps> = ({ sound, cellKey, isSelected, onSelect, onUpdateSound }) => {
    const parsed = parseCellKey(cellKey);
    const coordText = parsed ? `[${parsed.row},${parsed.col}]` : cellKey;

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(sound.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditName(sound.name);
    }, [sound.name]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (onUpdateSound && editName.trim() !== '') {
            onUpdateSound({ name: editName });
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setEditName(sound.name);
            setIsEditing(false);
        }
        e.stopPropagation();
    };

    return (
        <div
            onClick={() => {
                if (!isEditing) {
                    onSelect();
                }
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
            className={`
        p-3 rounded-md border transition-all duration-150 cursor-pointer
        ${isSelected || isEditing
                    ? 'bg-[var(--bg-card)] border-[var(--finger-L1)]'
                    : 'bg-[var(--bg-panel)] border-[var(--border-subtle)] hover:bg-[var(--bg-card)] hover:border-[var(--text-secondary)]'
                }
      `}
            style={{
                borderLeftWidth: '4px',
                borderLeftColor: sound.color || 'var(--finger-L1)',
            }}
        >
            <div className="flex items-center justify-between">
                <div className="font-medium text-[var(--text-primary)] text-sm flex-1">
                    {isEditing ? (
                        <input
                            ref={inputRef}
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={handleKeyDown}
                            className="w-full px-1 py-0.5 bg-[var(--bg-input)] border border-[var(--finger-L1)] rounded text-[var(--text-primary)] focus:outline-none"
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        sound.name
                    )}
                </div>
                <div className="text-xs text-[var(--text-secondary)] ml-2">
                    {coordText}
                </div>
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
                {sound.sourceType === 'midi_track' ? 'MIDI' : 'Audio'}
                {sound.originalMidiNote !== null && ` • Note ${sound.originalMidiNote}`}
            </div>
        </div>
    );
};

// ------------------------------------------------------------------
// Droppable Staging Area Component
// ------------------------------------------------------------------
export interface DroppableStagingAreaProps {
    children: React.ReactNode;
}

export const DroppableStagingArea: React.FC<DroppableStagingAreaProps> = ({ children }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'staging-area',
    });

    return (
        <div
            ref={setNodeRef}
            className={`
        min-h-[100px] transition-colors rounded
        ${isOver ? 'bg-[var(--bg-panel)] border-2 border-dashed border-[var(--finger-L1)]' : ''}
      `}
        >
            {children}
        </div>
    );
};

// ------------------------------------------------------------------
// Voice Library Component (Unified)
// ------------------------------------------------------------------
interface VoiceLibraryProps {
    parkedSounds: Voice[];
    activeMapping: GridMapping | null;
    projectState: ProjectState;
    instrumentConfig: InstrumentConfig | null;
    selectedSoundId: string | null;
    selectedCellKey: string | null;
    ignoredNoteNumbers: number[];
    onSelectSound: (id: string | null) => void;
    onSelectCell: (key: string | null) => void;
    onAddSound: (sound: Voice) => void;
    onUpdateSound: (id: string, updates: Partial<Voice>) => void;
    onUpdateMappingSound: (key: string, updates: Partial<Voice>) => void;
    onDeleteSound: (id: string) => void;
    onToggleVoiceVisibility: (note: number) => void;
    onImport?: (file: File) => void;
    handleDestructiveDelete: (note: number) => void;
    handleAutoAssignRandom: () => void;
    handleClearStaging: () => void;
}

export const VoiceLibrary: React.FC<VoiceLibraryProps> = ({
    parkedSounds,
    activeMapping,
    projectState,
    instrumentConfig,
    selectedSoundId,
    selectedCellKey,
    ignoredNoteNumbers,
    onSelectSound,
    onSelectCell,
    onAddSound,
    onUpdateSound,
    onUpdateMappingSound,
    onDeleteSound,
    onToggleVoiceVisibility,
    onImport,
    handleDestructiveDelete,
    handleAutoAssignRandom,
    handleClearStaging,
}) => {
    const [activeTab, setActiveTab] = useState<'all' | 'unassigned' | 'placed'>('unassigned');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Derived Data
    const placedAssets = activeMapping ? Object.values(activeMapping.cells) : [];
    const stagingAssets = parkedSounds;

    // Get raw detected voices (notes)
    const rawPerformance = getRawActivePerformance(projectState);
    const uniqueNotes = rawPerformance
        ? Array.from(new Set(rawPerformance.events.map(e => e.noteNumber))).sort((a, b) => a - b)
        : [];

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
        onSelectSound(newSound.id);
    };

    const handleMidiFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !onImport) return;
        onImport(file);
        if (event.target) event.target.value = '';
    };

    return (
        <div className="flex flex-col h-full">
            {/* Library Header */}
            <div className="flex items-center justify-between p-4 pb-2">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Voice Library</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleNewSound}
                        className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded border border-green-500 transition-colors"
                        title="Add New Sound"
                    >
                        + New
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2 py-1 text-xs bg-[var(--finger-L1)] hover:bg-[var(--finger-L2)] text-white rounded border border-[var(--finger-L2)] transition-colors"
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

            {/* Clear Staging Icon (Only visible in Unassigned tab) */}
            {activeTab === 'unassigned' && stagingAssets.length > 0 && (
                <div className="px-4 pb-2 flex justify-end">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Remove all ${stagingAssets.length} voices from staging?`)) {
                                handleClearStaging();
                            }
                        }}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-warning)] hover:bg-[var(--bg-panel)] rounded transition-colors flex items-center gap-1 text-xs"
                        title="Clear Staging Area"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear Staging
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-[var(--border-subtle)] px-4">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'all'
                        ? 'border-[var(--finger-L1)] text-[var(--text-primary)]'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                >
                    Detected ({uniqueNotes.length})
                </button>
                <button
                    onClick={() => setActiveTab('unassigned')}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'unassigned'
                        ? 'border-[var(--finger-L1)] text-[var(--text-primary)]'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                >
                    Unassigned ({stagingAssets.length})
                </button>
                <button
                    onClick={() => setActiveTab('placed')}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === 'placed'
                        ? 'border-[var(--finger-L1)] text-[var(--text-primary)]'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                >
                    Placed ({placedAssets.length})
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4">

                {/* TAB: ALL (Detected Voices) */}
                {activeTab === 'all' && (
                    <div className="space-y-2">
                        {uniqueNotes.length === 0 ? (
                            <div className="text-sm text-[var(--text-secondary)] text-center py-8 border-2 border-dashed border-[var(--border-subtle)] rounded">
                                No Voices detected
                                <br />
                                <span className="text-xs">Import a MIDI file to detect voices</span>
                            </div>
                        ) : (
                            uniqueNotes.map((noteNumber) => {
                                const isVisible = !ignoredNoteNumbers.includes(noteNumber);
                                const eventCount = rawPerformance?.events.filter(e => e.noteNumber === noteNumber).length || 0;

                                return (
                                    <div
                                        key={noteNumber}
                                        className="p-3 rounded-md border bg-[var(--bg-panel)] border-[var(--border-subtle)] hover:bg-[var(--bg-card)] hover:border-[var(--text-secondary)] transition-colors flex items-center justify-between gap-2"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-[var(--text-primary)] text-sm">
                                                Note {noteNumber}
                                            </div>
                                            <div className="text-xs text-[var(--text-secondary)] mt-1">
                                                {eventCount} {eventCount === 1 ? 'event' : 'events'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {/* Visibility Toggle */}
                                            <button
                                                onClick={() => onToggleVoiceVisibility(noteNumber)}
                                                className={`flex-shrink-0 p-1.5 rounded transition-colors ${isVisible
                                                    ? 'text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-panel)]'
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
                                                className="flex-shrink-0 p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-warning)] hover:bg-[var(--bg-panel)] rounded transition-colors"
                                                title="Permanently delete all events for this note"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* TAB: UNASSIGNED (Staging Area) */}
                {activeTab === 'unassigned' && (
                    <DroppableStagingArea>
                        {/* Assign Actions Toolbar */}
                        {stagingAssets.length > 0 && (
                            <div className="mb-3 p-2 bg-[var(--bg-panel)] rounded border border-[var(--border-subtle)]">
                                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">Assign Actions</div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleAutoAssignRandom}
                                        disabled={!activeMapping || !instrumentConfig || stagingAssets.length === 0}
                                        className="flex-1 px-3 py-1.5 text-xs bg-[var(--finger-L1)] hover:bg-[var(--finger-L2)] disabled:bg-[var(--bg-input)] disabled:text-[var(--text-secondary)] disabled:cursor-not-allowed text-white rounded border border-[var(--finger-L2)] disabled:border-[var(--border-subtle)] transition-colors"
                                        title={!activeMapping || !instrumentConfig ? 'No active mapping or instrument config' : 'Randomly assign unassigned Voices to empty Pads'}
                                    >
                                        Auto-Assign (Random)
                                    </button>
                                    <button
                                        disabled
                                        className="flex-1 px-3 py-1.5 text-xs bg-[var(--bg-input)] text-[var(--text-secondary)] cursor-not-allowed rounded border border-[var(--border-subtle)] flex items-center justify-center gap-1"
                                        title="AI Optimization coming in v2"
                                    >
                                        Auto-Assign (Optimize) 🧠
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="space-y-2 mt-2">
                            {stagingAssets.length === 0 ? (
                                <div className="text-sm text-[var(--text-secondary)] text-center py-8 border-2 border-dashed border-[var(--border-subtle)] rounded">
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
                                                onSelectSound(sound.id);
                                                onSelectCell(null);
                                            }}
                                            onEdit={(updates) => onUpdateSound(sound.id, updates)}
                                            onDelete={() => onDeleteSound?.(sound.id)}
                                            isVisible={isVisible}
                                            onToggleVisibility={onToggleVoiceVisibility}
                                        />
                                    );
                                })
                            )}
                        </div>
                    </DroppableStagingArea>
                )}

                {/* TAB: PLACED (Grid Assignments) */}
                {activeTab === 'placed' && (
                    <div className="space-y-2">
                        {activeMapping && Object.keys(activeMapping.cells).length > 0 ? (
                            Object.entries(activeMapping.cells).map(([cellKey, sound]) => (
                                <PlacedSoundItem
                                    key={`${cellKey}-${sound.id}`}
                                    sound={sound}
                                    cellKey={cellKey}
                                    isSelected={selectedCellKey === cellKey}
                                    onUpdateSound={(updates) => onUpdateMappingSound(cellKey, updates)}
                                    onSelect={() => {
                                        onSelectCell(cellKey);
                                        onSelectSound(null);
                                    }}
                                />
                            ))
                        ) : (
                            <div className="text-sm text-[var(--text-secondary)] text-center py-8 border-2 border-dashed border-[var(--border-subtle)] rounded">
                                No Voices placed on grid
                                <br />
                                <span className="text-xs">Drag Voices from Unassigned to the Grid</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
