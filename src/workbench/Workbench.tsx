import React, { useState, useMemo, useEffect } from 'react';
import { LayoutDesigner } from './LayoutDesigner';
import { ProjectState } from '../types/projectState';
import { GridMapping, SoundAsset } from '../types/layout';
import { InstrumentConfig, SectionMap } from '../data/models';
import { useProjectHistory } from '../hooks/useProjectHistory';
import { generateId } from '../utils/performanceUtils';
import { DEFAULT_TEST_MIDI_URL } from '../data/testData';
import { fetchAndParseMidiFile } from '../utils/midiImport';
import { GridMapService } from '../engine/gridMapService';
import { cellKey } from '../types/layout';

// Dummy Initial Data
const INITIAL_INSTRUMENT_CONFIG: InstrumentConfig = {
  id: 'inst-1',
  name: 'Standard Drum Kit',
  bottomLeftNote: 36, // C2
  rows: 8,
  cols: 8
};

const INITIAL_PROJECT_STATE: ProjectState = {
  layouts: [
    {
      id: 'layout-1',
      name: 'My First Layout',
      createdAt: new Date().toISOString(),
      performance: {
        events: [],
        tempo: 120,
        name: 'Demo Performance'
      }
    }
  ],
  instrumentConfigs: [INITIAL_INSTRUMENT_CONFIG],
  sectionMaps: [
    {
      id: 'section-1',
      name: 'Section 1',
      startMeasure: 1,
      lengthInMeasures: 4,
      instrumentConfig: INITIAL_INSTRUMENT_CONFIG
    }
  ],
  activeLayoutId: 'layout-1',
  projectTempo: 120,
  parkedSounds: [],
  mappings: [],
  // Safety Check: Default ignoredNoteNumbers to empty array (all voices visible by default)
  ignoredNoteNumbers: []
};

export const Workbench: React.FC = () => {
  const {
    projectState,
    setProjectState,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useProjectHistory(INITIAL_PROJECT_STATE);
  
  const [activeMappingId, setActiveMappingId] = useState<string | null>(null);

  const activeLayout = useMemo(() => 
    projectState.layouts.find(l => l.id === projectState.activeLayoutId) || null,
    [projectState.layouts, projectState.activeLayoutId]
  );

  const activeSection = useMemo(() => 
    projectState.sectionMaps[0] || null, // Simplified: just take first section for now
    [projectState.sectionMaps]
  );

  // Get active mapping for LayoutDesigner
  const activeMapping = useMemo(() => 
    activeMappingId 
      ? projectState.mappings.find(m => m.id === activeMappingId) || null
      : projectState.mappings.length > 0 
        ? projectState.mappings[0] 
        : null,
    [projectState.mappings, activeMappingId]
  );

  // Initialize activeMappingId if mappings exist but activeMappingId is null or invalid
  useEffect(() => {
    if (projectState.mappings.length > 0) {
      // If no activeMappingId is set, or if the activeMappingId doesn't exist in mappings, use the first one
      if (!activeMappingId || !projectState.mappings.find(m => m.id === activeMappingId)) {
        setActiveMappingId(projectState.mappings[0].id);
      }
    } else {
      // If there are no mappings, clear activeMappingId
      if (activeMappingId) {
        setActiveMappingId(null);
      }
    }
  }, [activeMappingId, projectState.mappings]);

  // Track if default MIDI has been loaded to show status indicator
  const [defaultMidiLoaded, setDefaultMidiLoaded] = useState(false);

  // View Settings state
  const [showNoteLabels, setShowNoteLabels] = useState(false);
  const [viewAllSteps, setViewAllSteps] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Auto-load default test MIDI file if no performance events exist
  useEffect(() => {
    // Only load if we have an active layout with no events and an active section
    if (!activeLayout || !activeSection) return;
    if (activeLayout.performance.events.length > 0) {
      setDefaultMidiLoaded(false); // Reset if layout already has events
      return; // Already has events, don't load
    }

    let isMounted = true;

    fetchAndParseMidiFile(DEFAULT_TEST_MIDI_URL, activeSection.instrumentConfig)
      .then(({ performance, unmappedNoteCount, minNoteNumber }) => {
        if (!isMounted) return; // Component unmounted, don't update state

        // Intelligent Root Note Logic: Auto-set bottomLeftNote to minimum note
        if (minNoteNumber !== null) {
          // Update the active section's instrument config
          setProjectState(prevState => {
            const updatedSectionMaps = prevState.sectionMaps.map(section => {
              if (section.id === activeSection.id) {
                return {
                  ...section,
                  instrumentConfig: {
                    ...section.instrumentConfig,
                    bottomLeftNote: minNoteNumber
                  }
                };
              }
              return section;
            });

            // Also update the instrument config in the instrumentConfigs array
            const updatedInstrumentConfigs = prevState.instrumentConfigs.map(config => {
              if (config.id === activeSection.instrumentConfig.id) {
                return {
                  ...config,
                  bottomLeftNote: minNoteNumber
                };
              }
              return config;
            });

            return {
              ...prevState,
              sectionMaps: updatedSectionMaps,
              instrumentConfigs: updatedInstrumentConfigs
            };
          });
        }

        if (unmappedNoteCount > 0) {
          console.warn(
            `Default test MIDI loaded with ${unmappedNoteCount} unmapped note event(s). ` +
            `Root note auto-adjusted to ${minNoteNumber !== null ? minNoteNumber : activeSection.instrumentConfig.bottomLeftNote} to fit all notes.`
          );
        }

        // CRITICAL FIX: Extract unique notes and create SoundAssets + grid assignments
        // This mirrors the logic in LayoutDesigner's handleMidiFileSelect
        const uniqueNotes = new Set<number>();
        performance.events.forEach(event => {
          uniqueNotes.add(event.noteNumber);
        });

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const getNoteName = (midiNote: number): string => {
          const note = noteNames[midiNote % 12];
          const octave = Math.floor(midiNote / 12) - 2;
          return `${note}${octave}`;
        };

        const colors = [
          '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
          '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
          '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
        ];

        // Create SoundAssets for each unique note
        const newSounds: SoundAsset[] = [];
        Array.from(uniqueNotes).forEach((noteNumber, index) => {
          const noteName = getNoteName(noteNumber);
          const newSound: SoundAsset = {
            id: `sound-default-${noteNumber}-${Date.now()}-${index}`,
            name: `${noteName} (${noteNumber})`,
            sourceType: 'midi_track' as const,
            sourceFile: DEFAULT_TEST_MIDI_URL,
            originalMidiNote: noteNumber,
            color: colors[index % colors.length],
          };
          newSounds.push(newSound);
        });

        // CRITICAL FIX: Ensure activeLayoutId is set and layout is properly created
        // Update the active layout with the loaded performance
        setProjectState(prevState => {
          // Ensure we have an active layout ID
          const layoutId = prevState.activeLayoutId || activeLayout.id;
          
          // Update or create the layout
          const updatedLayouts = prevState.layouts.map(layout => {
            if (layout.id === layoutId) {
              return {
                ...layout,
                performance: performance
              };
            }
            return layout;
          });

          // Ensure the layout exists (create if it doesn't)
          const layoutExists = updatedLayouts.some(l => l.id === layoutId);
          if (!layoutExists) {
            updatedLayouts.push({
              id: layoutId,
              name: activeLayout.name || 'Default Layout',
              createdAt: activeLayout.createdAt || new Date().toISOString(),
              performance: performance
            });
          }

          // Create or update mapping with grid cell assignments
          let updatedMappings = [...prevState.mappings];
          let mappingId = prevState.mappings.find(m => m.id === activeMappingId)?.id;
          
          // If no mapping exists, create one
          if (!mappingId) {
            mappingId = `mapping-${Date.now()}`;
            const cellsToAssign: Record<string, SoundAsset> = {};
            
            // Map each sound to its grid position
            newSounds.forEach(sound => {
              if (sound.originalMidiNote !== null) {
                const position = GridMapService.getPositionForNote(sound.originalMidiNote, activeSection.instrumentConfig);
                if (position) {
                  const cellKeyStr = cellKey(position.row, position.col);
                  cellsToAssign[cellKeyStr] = sound;
                }
              }
            });

            const newMapping: GridMapping = {
              id: mappingId,
              name: `${performance.name || DEFAULT_TEST_MIDI_URL} Layout`,
              cells: cellsToAssign,
              fingerConstraints: {},
              scoreCache: null,
              notes: `Auto-generated from ${DEFAULT_TEST_MIDI_URL}`,
            };
            updatedMappings.push(newMapping);
          } else {
            // Update existing mapping with new sounds
            updatedMappings = updatedMappings.map(m => {
              if (m.id === mappingId) {
                const cellsToAssign: Record<string, SoundAsset> = { ...m.cells };
                
                // Map each sound to its grid position
                newSounds.forEach(sound => {
                  if (sound.originalMidiNote !== null) {
                    const position = GridMapService.getPositionForNote(sound.originalMidiNote, activeSection.instrumentConfig);
                    if (position) {
                      const cellKeyStr = cellKey(position.row, position.col);
                      cellsToAssign[cellKeyStr] = sound;
                    }
                  }
                });

                return {
                  ...m,
                  cells: cellsToAssign,
                  notes: m.notes 
                    ? `${m.notes}\n\nAuto-populated from ${DEFAULT_TEST_MIDI_URL}`
                    : `Auto-populated from ${DEFAULT_TEST_MIDI_URL}`,
                };
              }
              return m;
            });
          }

          // Set active mapping ID if we created a new mapping
          if (mappingId && !activeMappingId) {
            setTimeout(() => setActiveMappingId(mappingId!), 0);
          }

          // Intelligent Merge: Identify all unique noteNumbers in the new performance
          const newNoteNumbers = new Set<number>();
          performance.events.forEach(event => {
            newNoteNumbers.add(event.noteNumber);
          });
          
          // Merge ignoredNoteNumbers: Keep only ignored notes that still exist in the new performance
          // Reset to empty array for new imports (all new voices visible by default)
          const previousIgnored = prevState.ignoredNoteNumbers || [];
          const mergedIgnored = previousIgnored.filter(noteNum => newNoteNumbers.has(noteNum));
          
          return {
            ...prevState,
            layouts: updatedLayouts,
            activeLayoutId: layoutId, // Explicitly set activeLayoutId
            projectTempo: performance.tempo || prevState.projectTempo,
            parkedSounds: [...prevState.parkedSounds, ...newSounds], // Add new sounds to library (don't destroy previous)
            mappings: updatedMappings,
            // Intelligent Merge: Reset ignoredNoteNumbers for new MIDI import (all new voices visible)
            // But preserve ignored state for notes that still exist
            ignoredNoteNumbers: mergedIgnored,
          };
        });

        setDefaultMidiLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to auto-load default test MIDI file:', err);
        setDefaultMidiLoaded(false);
        // Silently fail - don't show error to user, just log it
      });

    return () => {
      isMounted = false;
    };
  }, [activeLayout?.id, activeLayout?.performance.events.length, activeSection?.id]); // Include more dependencies to ensure proper updates

  const handleSaveProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "push3_project.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleLoadProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        // Basic validation
        if (
          parsed && 
          Array.isArray(parsed.layouts) && 
          Array.isArray(parsed.sectionMaps) &&
          typeof parsed.projectTempo === 'number'
        ) {
           // Ensure new fields are initialized if missing (for backward compatibility)
           const loadedState: ProjectState = {
             ...parsed,
             parkedSounds: Array.isArray(parsed.parkedSounds) ? parsed.parkedSounds : [],
             mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
             // Safety Check: Default ignoredNoteNumbers to empty array if undefined
             ignoredNoteNumbers: Array.isArray(parsed.ignoredNoteNumbers) ? parsed.ignoredNoteNumbers : []
           };
           setProjectState(loadedState, true); // Skip history on load
           // Initialize activeMappingId if mappings exist
           if (loadedState.mappings.length > 0) {
             setActiveMappingId(loadedState.mappings[0].id);
           }
        } else {
           alert("Invalid project file structure");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse project file");
      }
      // Reset input value so same file can be loaded again if needed
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  // LayoutDesigner handlers
  const handleAssignSound = (cellKey: string, sound: SoundAsset) => {
    if (!activeMapping) {
      // Create a new mapping if none exists
      const newMapping: GridMapping = {
        id: `mapping-${Date.now()}`,
        name: 'New Mapping',
        cells: { [cellKey]: sound },
        fingerConstraints: {},
        scoreCache: null,
        notes: '',
      };
      setProjectState({
        ...projectState,
        mappings: [...projectState.mappings, newMapping],
      });
      // Set activeMappingId immediately to ensure it's available
      setActiveMappingId(newMapping.id);
    } else {
      // Update existing mapping
      setProjectState({
        ...projectState,
        mappings: projectState.mappings.map(m => {
          if (m.id !== activeMapping.id) return m;
          return {
            ...m,
            cells: {
              ...m.cells,
              [cellKey]: sound,
            },
          };
        }),
      });
    }
  };

  const handleAssignSounds = (assignments: Record<string, SoundAsset>) => {
    if (!activeMapping) {
      // Create a new mapping with all assignments
      const newMapping: GridMapping = {
        id: `mapping-${Date.now()}`,
        name: 'New Mapping',
        cells: assignments,
        fingerConstraints: {},
        scoreCache: null,
        notes: '',
      };
      setProjectState({
        ...projectState,
        mappings: [...projectState.mappings, newMapping],
      });
      // Set activeMappingId immediately to ensure it's available
      setActiveMappingId(newMapping.id);
    } else {
      // Update existing mapping with all assignments
      setProjectState({
        ...projectState,
        mappings: projectState.mappings.map(m => {
          if (m.id !== activeMapping.id) return m;
          return {
            ...m,
            cells: {
              ...m.cells,
              ...assignments,
            },
          };
        }),
      });
    }
  };

  const handleUpdateMapping = (updates: Partial<GridMapping>) => {
    if (!activeMapping) return;
    
    setProjectState({
      ...projectState,
      mappings: projectState.mappings.map(m => {
        if (m.id !== activeMapping.id) return m;
        return { ...m, ...updates };
      }),
    });
  };

  const handleDuplicateMapping = () => {
    if (!activeMapping) return;
    
    const newMapping: GridMapping = {
      ...activeMapping,
      id: `mapping-${Date.now()}`,
      name: `${activeMapping.name} (Copy)`,
    };
    
    setProjectState({
      ...projectState,
      mappings: [...projectState.mappings, newMapping],
    });
    setActiveMappingId(newMapping.id);
  };

  const handleScanMidi = () => {
    // Stub for now - will be implemented later
    console.log('Scan MIDI clicked');
    // For testing, add a dummy sound
    const dummySound: SoundAsset = {
      id: `sound-${Date.now()}`,
      name: `Sound ${projectState.parkedSounds.length + 1}`,
      sourceType: 'midi_track',
      sourceFile: '',
      originalMidiNote: 36 + projectState.parkedSounds.length,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
    };
    setProjectState(prev => ({
      ...prev,
      parkedSounds: [...prev.parkedSounds, dummySound],
    }));
  };

  const handleAddSound = (sound: SoundAsset) => {
    setProjectState({
      ...projectState,
      parkedSounds: [...projectState.parkedSounds, sound],
    });
  };

  const handleUpdateSound = (soundId: string, updates: Partial<SoundAsset>) => {
    // Update in parkedSounds
    const updatedParkedSounds = projectState.parkedSounds.map(s => 
      s.id === soundId ? { ...s, ...updates } : s
    );

    // Also update in all mappings if the sound exists there
    const updatedMappings = projectState.mappings.map(m => {
      const updatedCells: Record<string, SoundAsset> = {};
      let hasChanges = false;

      Object.entries(m.cells).forEach(([cellKey, sound]) => {
        if (sound.id === soundId) {
          updatedCells[cellKey] = { ...sound, ...updates };
          hasChanges = true;
        } else {
          updatedCells[cellKey] = sound;
        }
      });

      return hasChanges ? { ...m, cells: updatedCells } : m;
    });

    setProjectState({
      ...projectState,
      parkedSounds: updatedParkedSounds,
      mappings: updatedMappings,
    });
  };

  const handleUpdateMappingSound = (cellKey: string, updates: Partial<SoundAsset>) => {
    if (!activeMapping) return;
    
    let soundIdToUpdate: string | null = null;
    let updatedCellSound: SoundAsset | null = null;

    // Update in the active mapping
    const updatedMappings = projectState.mappings.map(m => {
      if (m.id !== activeMapping.id) return m;
      const cellSound = m.cells[cellKey];
      if (!cellSound) return m;
      
      soundIdToUpdate = cellSound.id;
      updatedCellSound = { ...cellSound, ...updates };
      
      return {
        ...m,
        cells: {
          ...m.cells,
          [cellKey]: updatedCellSound,
        },
      };
    });

    // Also update in parkedSounds if the sound exists there
    const updatedParkedSounds = soundIdToUpdate
      ? projectState.parkedSounds.map(s => 
          s.id === soundIdToUpdate ? { ...s, ...updates } : s
        )
      : projectState.parkedSounds;

    setProjectState({
      ...projectState,
      parkedSounds: updatedParkedSounds,
      mappings: updatedMappings,
    });
  };

  const handleRemoveSound = (cellKey: string) => {
    if (!activeMapping) return;
    
    setProjectState({
      ...projectState,
      mappings: projectState.mappings.map(m => {
        if (m.id !== activeMapping.id) return m;
        const newCells = { ...m.cells };
        delete newCells[cellKey];
        return {
          ...m,
          cells: newCells,
        };
      }),
    });
  };

  const handleDeleteSound = (soundId: string) => {
    // Remove from parkedSounds
    const updatedParkedSounds = projectState.parkedSounds.filter(s => s.id !== soundId);
    
    // Also remove from all mappings if the sound is placed on the grid
    const updatedMappings = projectState.mappings.map(m => {
      const updatedCells: Record<string, SoundAsset> = {};
      let hasChanges = false;
      
      Object.entries(m.cells).forEach(([cellKey, sound]) => {
        if (sound.id !== soundId) {
          updatedCells[cellKey] = sound;
        } else {
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        return {
          ...m,
          cells: updatedCells,
        };
      }
      return m;
    });
    
    setProjectState({
      ...projectState,
      parkedSounds: updatedParkedSounds,
      mappings: updatedMappings,
    });
  };

  const handleUpdateSection = (id: string, updates: Partial<SectionMap> | { field: 'startMeasure' | 'lengthInMeasures' | 'bottomLeftNote'; value: number }) => {
    setProjectState({
      ...projectState,
      sectionMaps: projectState.sectionMaps.map(section => {
        if (section.id !== id) return section;
        
        // Handle legacy format: { field, value }
        if ('field' in updates && 'value' in updates) {
          const { field, value } = updates;
          if (field === 'bottomLeftNote') {
            return {
              ...section,
              instrumentConfig: {
                ...section.instrumentConfig,
                bottomLeftNote: value
              }
            };
          }
          return {
            ...section,
            [field]: value
          };
        }
        
        // Handle new format: Partial<SectionMap>
        if ('instrumentConfig' in updates) {
          return {
            ...section,
            instrumentConfig: updates.instrumentConfig!
          };
        }
        
        return {
          ...section,
          ...updates
        };
      })
    });
  };

  const handleDeleteSection = (id: string) => {
    setProjectState({
      ...projectState,
      sectionMaps: projectState.sectionMaps.filter(s => s.id !== id)
    });
  };

  // W1: Handler for creating new InstrumentConfig
  const handleCreateInstrumentConfig = (config: Omit<InstrumentConfig, 'id'>) => {
    const newConfig: InstrumentConfig = {
      ...config,
      id: generateId('inst'),
    };
    setProjectState({
      ...projectState,
      instrumentConfigs: [...projectState.instrumentConfigs, newConfig],
    });
  };

  // W1: Handler for creating new SectionMap
  const handleCreateSectionMap = (sectionMap: Omit<SectionMap, 'id'>) => {
    const newSection: SectionMap = {
      ...sectionMap,
      id: generateId('section'),
    };
    setProjectState({
      ...projectState,
      sectionMaps: [...projectState.sectionMaps, newSection],
    });
  };

  // W1: Handler for updating InstrumentConfig
  const handleUpdateInstrumentConfig = (id: string, updates: Partial<InstrumentConfig>) => {
    setProjectState({
      ...projectState,
      instrumentConfigs: projectState.instrumentConfigs.map(config =>
        config.id === id ? { ...config, ...updates } : config
      ),
      // Also update sectionMaps that reference this config
      sectionMaps: projectState.sectionMaps.map(section =>
        section.instrumentConfig.id === id
          ? {
              ...section,
              instrumentConfig: { ...section.instrumentConfig, ...updates },
            }
          : section
      ),
    });
  };

  // W1: Handler for deleting InstrumentConfig
  const handleDeleteInstrumentConfig = (id: string) => {
    // Prevent deletion if any section maps reference it
    const isReferenced = projectState.sectionMaps.some(
      section => section.instrumentConfig.id === id
    );
    if (isReferenced) {
      alert('Cannot delete instrument config: it is referenced by one or more section maps.');
      return;
    }
    
    setProjectState({
      ...projectState,
      instrumentConfigs: projectState.instrumentConfigs.filter(c => c.id !== id),
    });
  };

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const loadProjectInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header (Top) */}
      <div className="flex-none h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        {/* Left: App Title & Status Indicator */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-200">Push 3 Optimizer</h1>
          {/* UI Polish: Status indicator for default MIDI load */}
          {defaultMidiLoaded && (
            <div className="px-2 py-1 text-xs bg-blue-900/30 text-blue-300 border border-blue-700/50 rounded">
              Loaded Default: {DEFAULT_TEST_MIDI_URL}
            </div>
          )}
        </div>

        {/* Center: View Settings */}
        <div className="flex items-center gap-4 border border-slate-700 rounded px-3 py-1.5">
          <span className="text-xs text-slate-400 font-semibold">View Settings:</span>
          
          <label className="text-xs text-slate-400 flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showNoteLabels} 
              onChange={(e) => setShowNoteLabels(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800"
            />
            Show Note Labels
          </label>
          
          <label className="text-xs text-slate-400 flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={viewAllSteps} 
              onChange={(e) => setViewAllSteps(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800"
            />
            View All Steps
          </label>
          
          <label className="text-xs text-slate-400 flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showHeatmap} 
              onChange={(e) => setShowHeatmap(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800"
            />
            Show Heatmap
          </label>
        </div>

        {/* Right: Undo/Redo & Save/Load Project */}
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <div className="flex items-center gap-1 border border-slate-700 rounded p-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-200 rounded transition-colors"
              title="Undo (Ctrl/Cmd+Z)"
            >
              ↶ Undo
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-200 rounded transition-colors"
              title="Redo (Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z)"
            >
              ↷ Redo
            </button>
          </div>
          
          <div className="h-6 w-px bg-slate-800" />
          
          {/* Save/Load */}
          <button
            onClick={handleSaveProject}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Save Project
          </button>
          <button
            onClick={() => loadProjectInputRef.current?.click()}
            className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
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
      </div>

      {/* Main Body (Middle) - Unified Workbench */}
      <div className="flex-1 overflow-hidden">
        <LayoutDesigner
          parkedSounds={projectState.parkedSounds}
          activeMapping={activeMapping}
          instrumentConfig={activeSection?.instrumentConfig || null}
          onAssignSound={handleAssignSound}
          onAssignSounds={handleAssignSounds}
          onUpdateMapping={handleUpdateMapping}
          onDuplicateMapping={handleDuplicateMapping}
          onAddSound={handleAddSound}
          onUpdateSound={handleUpdateSound}
          onUpdateMappingSound={handleUpdateMappingSound}
          onRemoveSound={handleRemoveSound}
          onDeleteSound={handleDeleteSound}
          projectState={projectState}
          onUpdateProjectState={setProjectState}
          onSetActiveMappingId={setActiveMappingId}
          activeLayout={activeLayout}
          onUpdateSection={handleUpdateSection}
          onDeleteSection={handleDeleteSection}
          onCreateInstrumentConfig={handleCreateInstrumentConfig}
          onCreateSectionMap={handleCreateSectionMap}
          onUpdateInstrumentConfig={handleUpdateInstrumentConfig}
          onDeleteInstrumentConfig={handleDeleteInstrumentConfig}
          showNoteLabels={showNoteLabels}
          viewAllSteps={viewAllSteps}
          showHeatmap={showHeatmap}
        />
      </div>
    </div>
  );
};
