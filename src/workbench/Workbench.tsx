import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { Button } from '../components/ui/Button';
import { LayoutDesigner } from './LayoutDesigner';
import { GridMapping, Voice, cellKey } from '../types/layout';
import { InstrumentConfig } from '../types/performance';
import { generateId } from '../utils/performanceUtils';
import { fetchMidiProject, parseMidiFileToProject } from '../utils/midiImport';
import { mapToQuadrants } from '../utils/autoLayout';
import { BiomechanicalSolver, SolverType } from '../engine/core';
import { FingerType } from '../engine/models';
import { getActivePerformance } from '../utils/performanceSelectors';
import {
  FINGER_PRIORITY_ORDER,
  getPose0PadsWithOffset,
  getMaxSafeOffset,
  poseHasAssignments,
  createDefaultPose0,
} from '../types/naturalHandPose';
import { seedMappingFromPose0 } from '../engine/seedMappingFromPose0';
import { AnalysisPanel } from './AnalysisPanel';
import { ThemeToggle } from '../components/ThemeToggle';
import { songService } from '../services/SongService';
import { useSongStateHydration } from '../hooks/useSongStateHydration';
import { saveProject, loadProject } from '../utils/projectPersistence';

// Dev-only flag: only show Cost Debug in development builds
// This is a developer-facing diagnostic view that relies on EngineResult.debugEvents
// and costBreakdown data. Safe to disable in production builds.
const SHOW_COST_DEBUG = import.meta.env.MODE === 'development';

export const Workbench: React.FC = () => {
  const {
    projectState,
    setProjectState,
    undo,
    redo,
    canUndo,
    canRedo,
    setActiveSolverId,
    optimizeLayout,
    runSolver,
    engineResult,
  } = useProject();

  const [searchParams] = useSearchParams();
  const songId = searchParams.get('songId');
  const [currentSongId, setCurrentSongId] = useState<string | null>(songId);
  const [loadError, setLoadError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    setCurrentSongId(songId);
  }, [songId]);

  const { hasLoadedSong, songName } = useSongStateHydration(currentSongId);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Derive activeSolverId from projectState
  // const activeSolverId = projectState.activeSolverId;

  // Derive activeMappingId from projectState
  const activeMappingId = projectState.activeMappingId;

  const activeLayout = useMemo(() =>
    projectState.layouts.find(l => l.id === projectState.activeLayoutId) || null,
    [projectState.layouts, projectState.activeLayoutId]
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

  // Use a ref to track the previous mappings array to detect actual changes
  const prevMappingsRef = useRef(projectState.mappings);
  const activeMappingIdRef = useRef(activeMappingId);
  activeMappingIdRef.current = activeMappingId;

  // Initialize or update activeMappingId when mappings change
  // Uses refs to avoid depending on activeMappingId (which would cause loops)
  useEffect(() => {
    const mappings = projectState.mappings;
    const currentId = activeMappingIdRef.current;

    // Only process if mappings actually changed (reference check)
    // This prevents unnecessary updates on every render
    if (mappings === prevMappingsRef.current && currentId !== null) {
      return;
    }
    prevMappingsRef.current = mappings;

    if (mappings.length > 0) {
      // Check if current selection is still valid
      const mappingExists = mappings.find(m => m.id === currentId);
      if (!currentId || !mappingExists) {
        // Select first mapping only if current is invalid
        setProjectState(prev => ({
          ...prev,
          activeMappingId: mappings[0].id
        }));
      }
    } else if (currentId !== null) {
      // Clear selection if no mappings
      setProjectState(prev => ({
        ...prev,
        activeMappingId: null
      }));
    }
  }, [projectState.mappings, setProjectState]);


  // Auto-save project state changes back to the song (debounced)
  useEffect(() => {
    // Only auto-save if we have a song loaded and the state has been initialized
    if (!currentSongId || !hasLoadedSong) return;

    // Skip saving if the project state is empty (initial state)
    if (projectState.layouts.length === 0 && projectState.parkedSounds.length === 0) return;

    // Debounce saving to prevent excessive writes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      console.log('[Workbench] Auto-saving project state for song:', currentSongId);
      songService.saveSongState(currentSongId, projectState);
    }, 1000); // 1 second debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [projectState, currentSongId, hasLoadedSong]);

  // Save immediately on unmount (flush pending save)
  useEffect(() => {
    return () => {
      // Cancel pending debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Perform immediate save on unmount if we have a song loaded
      // We use a ref pattern to get current values in cleanup
    };
  }, []);

  // Use a ref to track current values for unmount save
  const currentSongIdRef = useRef<string | null>(null);
  const projectStateRef = useRef(projectState);
  const hasLoadedSongRef = useRef(hasLoadedSong);

  useEffect(() => {
    currentSongIdRef.current = currentSongId;
    projectStateRef.current = projectState;
    hasLoadedSongRef.current = hasLoadedSong;
  }, [currentSongId, projectState, hasLoadedSong]);

  // Immediate save on unmount
  useEffect(() => {
    return () => {
      if (currentSongIdRef.current && hasLoadedSongRef.current) {
        console.log('[Workbench] Saving on unmount for song:', currentSongIdRef.current);
        songService.saveSongState(currentSongIdRef.current, projectStateRef.current);
      }
    };
  }, []);

  // Track if default MIDI has been loaded to show status indicator

  // View Settings state
  const [showNoteLabels, setShowNoteLabels] = useState(false);
  const [showPositionLabels, setShowPositionLabels] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setSettingsMenuOpen(false);
      }
    };

    if (settingsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [settingsMenuOpen]);

  // Solver control state
  const [selectedSolver, setSelectedSolver] = useState<SolverType>('beam');
  const [isRunningSolver, setIsRunningSolver] = useState(false);
  const [solverProgress, setSolverProgress] = useState(0);
  /** When false, hide Beam/Genetic comparison; always use Beam. */
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Layout optimization state
  const [isOptimizingLayout, setIsOptimizingLayout] = useState(false);

  // Neutral pose state


  // Engine state


  // Timeline state
  const filteredPerformance = useMemo(() => getActivePerformance(projectState), [projectState]);

  // Handler for running solver
  const handleRunSolver = useCallback(async () => {
    if (!filteredPerformance || filteredPerformance.events.length === 0) {
      alert('No performance data available. Please load a MIDI file first.');
      return;
    }

    setIsRunningSolver(true);
    setSolverProgress(0);

    try {
      const solverToRun = showAdvanced ? selectedSolver : 'beam';
      // For genetic solver, simulate progress updates
      if (solverToRun === 'genetic') {
        // Create a progress interval (genetic solver runs async)
        const progressInterval = setInterval(() => {
          setSolverProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 5;
          });
        }, 500);

        await runSolver(solverToRun, activeMapping);

        clearInterval(progressInterval);
        setSolverProgress(100);

        // Set as active solver
        setActiveSolverId(solverToRun);
      } else {
        // Beam solver is fast, no progress needed
        await runSolver(solverToRun, activeMapping);
        setActiveSolverId(solverToRun);
        setSolverProgress(100);
      }
    } catch (error) {
      console.error('[Workbench] Solver execution failed:', error);
      alert(`Solver execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunningSolver(false);
      setTimeout(() => setSolverProgress(0), 1000); // Reset progress after 1s
    }
  }, [selectedSolver, showAdvanced, filteredPerformance, activeMapping, runSolver, setActiveSolverId]);


  /**
   * Unified project load handler that processes MIDI files and updates project state atomically.
   * This function handles both default loading and user file imports.
   * 
   * @param source - Either a File object or a URL string
   * @param existingConfig - Optional existing instrument config to use as base
   */
  // @ts-ignore
  const handleProjectLoad = useCallback(async (
    source: File | string,
    existingConfig?: InstrumentConfig
  ): Promise<void> => {
    console.log('[Workbench] handleProjectLoad - CALLED', {
      sourceType: typeof source,
      sourceName: typeof source === 'string' ? source : source.name,
      hasExistingConfig: !!existingConfig,
    });

    try {
      // Use the unified import function
      console.log('[Workbench] handleProjectLoad - Starting MIDI parsing...');
      const projectData = typeof source === 'string'
        ? await fetchMidiProject(source, existingConfig)
        : await parseMidiFileToProject(source, existingConfig);

      console.log('[Workbench] handleProjectLoad - MIDI parsing complete:', {
        voicesCount: projectData.voices.length,
        performanceEvents: projectData.performance.events.length,
        gridMappingCells: Object.keys(projectData.gridMapping.cells).length,
      });

      // Atomic state update - no setTimeout, no side effects
      setProjectState(prevState => {
        // HARD RESET: Always create a new layout for the imported MIDI
        const layoutId = generateId('layout');

        // DEBUG: Log layout creation
        console.log('[Workbench] handleProjectLoad - Creating new layout:', {
          layoutId,
          performanceEvents: projectData.performance.events.length,
          performanceName: projectData.performance.name,
          prevActiveLayoutId: prevState.activeLayoutId,
          prevLayoutsCount: prevState.layouts.length,
        });

        // Create new layout (don't merge with existing)
        const updatedLayouts = [{
          id: layoutId,
          name: projectData.performance.name || 'Imported Layout',
          createdAt: new Date().toISOString(),
          performance: projectData.performance,
        }];

        // DEBUG: Verify performance has events
        console.log('[Workbench] handleProjectLoad - New layout performance:', {
          layoutId,
          performanceEventsCount: updatedLayouts[0].performance.events.length,
          performanceName: updatedLayouts[0].performance.name,
        });

        // HARD RESET: Replace instrument configs and mappings entirely
        const updatedInstrumentConfigs = [projectData.instrumentConfig];
        // Ensure layoutMode is 'none' - grid starts empty, users must explicitly assign
        const updatedMappings = [{
          ...projectData.gridMapping,
          layoutMode: 'none' as const,
        }];

        // HARD RESET: Replace voices entirely, don't merge
        // Reset ignoredNoteNumbers to empty (all new voices visible by default)
        // const newActiveMappingId = projectData.gridMapping.id;

        // DEBUG: Log voices being set
        console.log('[Workbench] handleProjectLoad - Setting voices:', projectData.voices.length);
        projectData.voices.forEach(v => console.log(`  - ${v.name} (MIDI ${v.originalMidiNote})`));

        // DEBUG: Log state being set
        const newState = {
          ...prevState,
          layouts: updatedLayouts,
          activeLayoutId: layoutId, // Set to new layout
          instrumentConfigs: updatedInstrumentConfigs,
          instrumentConfig: projectData.instrumentConfig,
          mappings: updatedMappings,
          parkedSounds: projectData.voices, // REPLACE, don't merge - ALL voices go here
          projectTempo: projectData.performance.tempo || prevState.projectTempo,
          ignoredNoteNumbers: [], // Reset to empty on new import
          activeMappingId: projectData.gridMapping.id,
        };

        console.log('[Workbench] handleProjectLoad - Setting state:', {
          layoutId,
          newActiveLayoutId: newState.activeLayoutId,
          layoutsCount: newState.layouts.length,
          layoutPerformanceEvents: newState.layouts[0]?.performance?.events?.length || 0,
          parkedSoundsCount: newState.parkedSounds.length,
          mappingsCount: newState.mappings.length,
        });

        // DEBUG: Verify the new layout is in the state
        const newLayoutInState = newState.layouts.find(l => l.id === layoutId);
        console.log('[Workbench] handleProjectLoad - Verification:', {
          newLayoutFound: !!newLayoutInState,
          newLayoutEvents: newLayoutInState?.performance?.events?.length || 0,
        });

        return newState;
      });

      // DEBUG: Log after state update (but state might not be updated yet due to async nature)
      console.log('[Workbench] handleProjectLoad - State update queued, waiting for next render...');

      // activeMappingId was already set directly via activeMappingId: projectData.gridMapping.id in the state update queuing


      // DEBUG: Log mapping ID being set
      console.log('[Workbench] handleProjectLoad - Setting active mapping ID:', projectData.gridMapping.id);

      // Verify engine works with the new data
      // Pass engine configuration from project state (or use defaults)
      const solver = new BiomechanicalSolver(
        projectData.instrumentConfig,
        projectData.gridMapping,
        undefined, // Use default engine constants
        projectState.engineConfiguration
      );
      const engineResult = solver.solve(projectData.performance);
      console.log('[Workbench] Engine verification result:', {
        score: engineResult.score,
        unplayableCount: engineResult.unplayableCount,
        hardCount: engineResult.hardCount,
        totalEvents: projectData.performance.events.length,
        fingerUsageStats: engineResult.fingerUsageStats,
      });

    } catch (err) {
      console.error('Failed to load MIDI project:', err);
      throw err; // Re-throw so caller can handle
    }
  }, [setProjectState, activeMappingId]);

  // DISABLED: Auto-load default test MIDI file
  // User wants to start with blank screen and manually drag/drop files
  // useEffect(() => {
  //   if (!activeLayout || !activeSection) return;
  //   if (activeLayout.performance.events.length > 0) {
  //     setDefaultMidiLoaded(false);
  //     return;
  //   }

  //   let isMounted = true;
  //   handleProjectLoad(DEFAULT_TEST_MIDI_URL, activeSection.instrumentConfig)
  //     .then(() => {
  //       if (isMounted) {
  //         setDefaultMidiLoaded(true);
  //       }
  //     })
  //     .catch(() => {
  //       if (isMounted) {
  //         setDefaultMidiLoaded(false);
  //       }
  //     });

  //   return () => {
  //     isMounted = false;
  //   };
  // }, [activeLayout?.id, activeLayout?.performance.events.length, activeSection?.id, handleProjectLoad]);



  const handleSaveProject = () => {
    saveProject(projectState);
  };

  const handleLoadProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoadError(null);
    const result = await loadProject(file);

    if (result.ok) {
      const loadedState = result.state;
      if (loadedState.mappings.length > 0 && !loadedState.activeMappingId) {
        loadedState.activeMappingId = loadedState.mappings[0].id;
      }
      setProjectState(loadedState, true);
    } else {
      setLoadError({ code: result.error.code, message: result.error.message });
    }

    event.target.value = '';
  };

  // LayoutDesigner handlers
  // When user manually drags a sound to a pad, set layoutMode to 'manual'
  const handleAssignSound = (cellKeyStr: string, sound: Voice) => {
    if (!activeMapping) {
      // Create a new mapping if none exists (with layoutMode: 'manual')
      const newMapping: GridMapping = {
        id: `mapping-${Date.now()}`,
        name: 'New Mapping',
        cells: { [cellKeyStr]: sound },
        fingerConstraints: {},
        scoreCache: null,
        notes: '',
        layoutMode: 'manual', // User-initiated assignment
      };
      setProjectState({
        ...projectState,
        mappings: [...projectState.mappings, newMapping],
        activeMappingId: newMapping.id,
      });
    } else {
      // Update existing mapping, set layoutMode to 'manual' (user modified the layout)
      setProjectState({
        ...projectState,
        mappings: projectState.mappings.map(m => {
          if (m.id !== activeMapping.id) return m;
          return {
            ...m,
            cells: {
              ...m.cells,
              [cellKeyStr]: sound,
            },
            layoutMode: 'manual', // User modified the layout
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

  // @ts-ignore
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
      activeMappingId: newMapping.id,
    });
  };

  const handleAssignmentChange = (eventKey: string, hand: 'left' | 'right', finger: FingerType) => {
    if (!projectState.activeLayoutId) return;

    setProjectState(prevState => {
      const layoutId = prevState.activeLayoutId!;
      const currentLayoutAssignments = prevState.manualAssignments?.[layoutId] || {};

      return {
        ...prevState,
        manualAssignments: {
          ...prevState.manualAssignments,
          [layoutId]: {
            ...currentLayoutAssignments,
            [eventKey]: { hand, finger }
          }
        }
      };
    });
  };

  // Handle map to quadrants (for settings menu)
  const handleMapToQuadrants = () => {
    if (!projectState.instrumentConfig) {
      alert('No instrument configuration available. Cannot perform auto-layout.');
      return;
    }

    // Collect all sounds that have originalMidiNote set
    const soundsWithNotes = projectState.parkedSounds.filter(s => s.originalMidiNote !== null);

    // Also include sounds from active mapping
    if (activeMapping) {
      Object.values(activeMapping.cells).forEach(sound => {
        if (sound.originalMidiNote !== null && !soundsWithNotes.find(s => s.id === sound.id)) {
          soundsWithNotes.push(sound);
        }
      });
    }

    if (soundsWithNotes.length === 0) {
      alert('No sounds with MIDI note information found. Sounds need originalMidiNote to be auto-laid out.');
      return;
    }

    // Map sounds to quadrants
    const assignments = mapToQuadrants(soundsWithNotes, projectState.instrumentConfig.bottomLeftNote);

    if (Object.keys(assignments).length === 0) {
      alert('No sounds could be mapped to quadrants. Check that sounds have valid MIDI note numbers.');
      return;
    }

    // Apply the assignments
    if (!activeMapping) {
      // Create a new mapping
      const newMapping: GridMapping = {
        id: `mapping-${Date.now()}`,
        name: 'Quadrant Layout',
        cells: assignments,
        fingerConstraints: {},
        scoreCache: null,
        notes: 'Auto-laid out to 4x4 quadrants',
        layoutMode: 'auto',
      };
      setProjectState({
        ...projectState,
        mappings: [...projectState.mappings, newMapping],
        activeMappingId: newMapping.id,
      });
    } else {
      // Update existing mapping
      setProjectState({
        ...projectState,
        mappings: projectState.mappings.map(m => {
          if (m.id !== activeMapping.id) return m;
          return {
            ...m,
            cells: assignments,
            name: 'Quadrant Layout',
            notes: 'Auto-laid out to 4x4 quadrants',
            layoutMode: 'auto',
          };
        }),
      });
    }
  };

  const handleAddSound = (sound: Voice) => {
    setProjectState({
      ...projectState,
      parkedSounds: [...projectState.parkedSounds, sound],
    });
  };

  const handleUpdateSound = (soundId: string, updates: Partial<Voice>) => {
    // Update in parkedSounds
    const updatedParkedSounds = projectState.parkedSounds.map(s =>
      s.id === soundId ? { ...s, ...updates } : s
    );

    // Also update in all mappings if the sound exists there
    const updatedMappings = projectState.mappings.map(m => {
      const updatedCells: Record<string, Voice> = {};
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

  const handleUpdateMappingSound = (cellKey: string, updates: Partial<Voice>) => {
    if (!activeMapping) return;

    let soundIdToUpdate: string | null = null;
    let updatedCellSound: Voice | null = null;

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
      const updatedCells: Record<string, Voice> = {};
      let hasChanges = false;

      Object.entries(m.cells).forEach(([cellKeyStr, sound]) => {
        if (sound.id !== soundId) {
          updatedCells[cellKeyStr] = sound;
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

  // ============================================================================
  // EXPLICIT LAYOUT CONTROL: Assign Manually (Random Placement)
  // ============================================================================
  // Maps all unassigned Voices to empty Pads using random, non-colliding placement.
  // Does NOT move already-assigned pads. Sets layoutMode to 'random'.
  // ============================================================================
  const handleAutoAssignRandom = () => {
    if (!activeMapping || !projectState.instrumentConfig) {
      alert('No active mapping or instrument config available. Please create a mapping first.');
      return;
    }

    // Find all unassigned Voices (in staging, not yet assigned to a Pad)
    // We filter parkedSounds to those NOT in the active mapping
    const assignedIds = new Set(Object.values(activeMapping.cells).map(v => v.id));
    const unassignedVoices = projectState.parkedSounds.filter(s => !assignedIds.has(s.id));

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

    // Batch assign all at once and update layoutMode to 'random'
    // Batch assign all at once and update layoutMode to 'random'
    if (Object.keys(assignments).length > 0) {
      // Merge new assignments with existing cells and update layoutMode
      if (!activeMapping) {
        // Create a new mapping with all assignments
        const newMapping: GridMapping = {
          id: `mapping-${Date.now()}`,
          name: 'New Mapping',
          cells: assignments,
          fingerConstraints: {},
          scoreCache: null,
          notes: '',
          layoutMode: 'random',
        };
        setProjectState({
          ...projectState,
          mappings: [...projectState.mappings, newMapping],
          activeMappingId: newMapping.id,
        });
        // Set activeMappingId immediately to ensure it's available
      } else {
        // Update existing mapping with all assignments AND layoutMode atomically
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
              layoutMode: 'random',
            };
          }),
        });
      }

      console.log(`[Workbench] Assign Randomly: placed ${Object.keys(assignments).length} voices randomly.`);
    }
  };

  // ============================================================================
  // EXPLICIT LAYOUT CONTROL: Seed from Pose0 (Full Coverage)
  // ============================================================================
  const handleSeedFromPose0 = useCallback(() => {
    const performance = getActivePerformance(projectState);
    if (!performance || performance.events.length === 0) {
      alert('No performance data. Load a MIDI file first.');
      return;
    }
    const pose0 = projectState.naturalHandPoses?.[0] ?? createDefaultPose0();
    if (!poseHasAssignments(pose0)) {
      alert('Configure Natural Hand Pose in the Pose tab first.');
      return;
    }
    const voiceMap = new Map<number, Voice>();
    for (const v of projectState.parkedSounds) {
      if (v.originalMidiNote != null) voiceMap.set(v.originalMidiNote, v);
    }
    for (const v of Object.values(activeMapping?.cells ?? {})) {
      if (v.originalMidiNote != null) voiceMap.set(v.originalMidiNote, v);
    }
    const seeded = seedMappingFromPose0(
      performance,
      pose0,
      projectState.instrumentConfig,
      0,
      voiceMap
    );
    if (!activeMapping) {
      setProjectState(prev => ({
        ...prev,
        mappings: [...prev.mappings, seeded],
        activeMappingId: seeded.id,
      }));
    } else {
      setProjectState(prev => ({
        ...prev,
        mappings: prev.mappings.map(m =>
          m.id === activeMapping.id ? { ...seeded, id: m.id, name: m.name } : m
        ),
      }));
    }
  }, [projectState, activeMapping, setProjectState]);

  // ============================================================================
  // EXPLICIT LAYOUT CONTROL: Assign Using Natural Pose (Deterministic)
  // ============================================================================
  // Maps unassigned Voices to Pads using Pose 0 anchor pads as priority,
  // sorted by voice importance (note-on count). Deterministic, not random.
  // ============================================================================
  const handleAutoAssignNaturalPose = () => {
    if (!activeMapping || !projectState.instrumentConfig) {
      alert('No active mapping or instrument config available. Please create a mapping first.');
      return;
    }

    // Get Pose 0
    const pose0 = projectState.naturalHandPoses?.[0] ?? createDefaultPose0();
    if (!poseHasAssignments(pose0)) {
      alert('No Natural Hand Pose configured. Please configure Pose 0 first, or use Random assignment.');
      return;
    }

    // Find all unassigned Voices (in staging, not yet assigned to a Pad)
    const assignedIds = new Set(Object.values(activeMapping.cells).map(v => v.id));
    const unassignedVoices = projectState.parkedSounds.filter(s => !assignedIds.has(s.id));

    if (unassignedVoices.length === 0) {
      alert('No unassigned Voices found. All Voices are already assigned to Pads.');
      return;
    }

    // Sort voices by importance (note-on count, descending - most important first)
    // Calculate importance from the active performance
    const performance = getActivePerformance(projectState);
    const voiceImportance = new Map<string, number>();
    if (performance) {
      for (const event of performance.events) {
        const voice = unassignedVoices.find(v => v.originalMidiNote === event.noteNumber);
        if (voice) {
          voiceImportance.set(voice.id, (voiceImportance.get(voice.id) || 0) + 1);
        }
      }
    }
    
    // Sort by importance (descending)
    const sortedVoices = [...unassignedVoices].sort((a, b) => {
      const importanceA = voiceImportance.get(a.id) || 0;
      const importanceB = voiceImportance.get(b.id) || 0;
      return importanceB - importanceA;
    });

    // Get Pose 0 anchor pads with max safe offset
    const safeOffset = getMaxSafeOffset(pose0, true);
    const anchorPads = getPose0PadsWithOffset(pose0, safeOffset, true);
    
    // Build ordered pad list: anchor pads first (in finger priority order), then other empty pads
    const anchorPadKeys = new Set<string>();
    const orderedPads: Array<{ row: number; col: number; key: string }> = [];
    
    // Add anchor pads in finger priority order
    for (const fingerId of FINGER_PRIORITY_ORDER) {
      const anchor = anchorPads.find(p => p.fingerId === fingerId);
      if (anchor && anchor.row >= 0 && anchor.row <= 7) {
        const key = cellKey(anchor.row, anchor.col);
        // Only add if empty (not already assigned)
        if (!activeMapping.cells[key] && !anchorPadKeys.has(key)) {
          orderedPads.push({ row: anchor.row, col: anchor.col, key });
          anchorPadKeys.add(key);
        }
      }
    }
    
    // Add remaining empty pads (row-major order for determinism)
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const key = cellKey(row, col);
        if (!activeMapping.cells[key] && !anchorPadKeys.has(key)) {
          orderedPads.push({ row, col, key });
        }
      }
    }

    if (orderedPads.length === 0) {
      alert('No empty Pads available. All 64 Pads are already assigned.');
      return;
    }

    // Map sorted voices to ordered pads (deterministic)
    const assignments: Record<string, Voice> = {};
    const maxAssignments = Math.min(sortedVoices.length, orderedPads.length);

    for (let i = 0; i < maxAssignments; i++) {
      assignments[orderedPads[i].key] = sortedVoices[i];
    }

    // Batch assign all at once and update layoutMode
    if (Object.keys(assignments).length > 0) {
      if (!activeMapping) {
        const newMapping: GridMapping = {
          id: `mapping-${Date.now()}`,
          name: 'New Mapping',
          cells: assignments,
          fingerConstraints: {},
          scoreCache: null,
          notes: '',
          layoutMode: 'manual', // Natural Pose is a form of manual/deterministic layout
        };
        setProjectState({
          ...projectState,
          mappings: [...projectState.mappings, newMapping],
          activeMappingId: newMapping.id,
        });
      } else {
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
              layoutMode: 'manual',
            };
          }),
        });
      }

      console.log(`[Workbench] Assign Natural Pose: placed ${Object.keys(assignments).length} voices deterministically.`);
    }
  };

  // Check if Natural Pose is available
  const pose0 = projectState.naturalHandPoses?.[0];
  const hasNaturalPose = pose0 && poseHasAssignments(pose0);

  // ============================================================================
  // EXPLICIT LAYOUT CONTROL: Clear Grid
  // ============================================================================
  // Removes all pad assignments and moves sounds back to staging.
  // Sets layoutMode to 'none'.
  // ============================================================================
  const handleClearGrid = () => {
    if (!activeMapping) {
      return;
    }

    if (Object.keys(activeMapping.cells).length === 0) {
      return;
    }

    // Sounds are already in parkedSounds (since they are just references), 
    // but we need to ensure the logic knows they are unassigned.
    handleUpdateMapping({
      cells: {},
      layoutMode: 'none',
    });

    console.log('[Workbench] Clear Grid: all sounds moved to staging. Layout mode set to "none".');
  };

  // ============================================================================
  // EXPLICIT LAYOUT CONTROL: Optimize Layout (Simulated Annealing)
  // ============================================================================
  // Runs the Simulated Annealing solver to find an optimal layout.
  // IMPORTANT: This OVERWRITES the current layout with the optimized result.
  // Only runs when explicitly triggered by user clicking "Auto-Arrange Grid" button.
  // ============================================================================
  const handleOptimizeLayout = useCallback(async () => {
    if (!activeMapping) {
      alert('No active mapping to optimize. Please assign some sounds first.');
      return;
    }

    const currentCells = activeMapping.cells;
    if (Object.keys(currentCells).length === 0) {
      alert('No sounds assigned to the grid. Please assign sounds first, then optimize.');
      return;
    }

    // Get the current performance to optimize for
    const performance = getActivePerformance(projectState);
    if (!performance || performance.events.length === 0) {
      alert('No performance data available. Cannot optimize without MIDI events.');
      return;
    }

    // Ensure Pose0 exists (use default if missing)
    if (!projectState.naturalHandPoses?.length) {
      setProjectState(prev => ({
        ...prev,
        naturalHandPoses: [createDefaultPose0()],
      }));
    }

    // Enforce full coverage: block if any sounds are unmapped
    const { computeMappingCoverage } = await import('@/engine/mappingCoverage');
    const coverage = computeMappingCoverage(performance, activeMapping);
    if (coverage.unmappedNotes.length > 0) {
      alert(
        `Mapping must cover all sounds for optimization. ${coverage.unmappedNotes.length} note(s) are unmapped (e.g. MIDI ${coverage.unmappedNotes.slice(0, 5).join(', ')}${coverage.unmappedNotes.length > 5 ? '...' : ''}). Use "Seed from Pose0" or assign manually.`
      );
      return;
    }

    console.log('[Workbench] Starting layout optimization with Simulated Annealing...');
    setIsOptimizingLayout(true);

    try {
      // Call the optimizeLayout method from context
      await optimizeLayout(activeMapping);

      console.log('[Workbench] Layout optimization complete!');

      // The context method already updates the project state and engine result
      // No need to do anything else here
    } catch (err) {
      console.error('[Workbench] Optimization failed:', err);
      alert(`Layout optimization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsOptimizingLayout(false);
    }
  }, [activeMapping, projectState, optimizeLayout, setProjectState]);







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
    <div className="h-screen w-screen flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden font-[family-name:var(--font-ui)] selection:bg-blue-500/30">
      {/* Project load error banner (non-disruptive; no alert) */}
      {loadError && (
        <div className="flex-none px-6 py-3 bg-red-950/80 border-b border-red-700/50 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-200">{loadError.message}</p>
            <p className="text-xs text-red-300/80 mt-0.5">Use a valid project file exported from this app, or re-export and try again.</p>
          </div>
          <button
            type="button"
            onClick={() => setLoadError(null)}
            className="flex-none px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-900/50 rounded border border-red-700/50 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Header (Top) - Premium Glassmorphism Look */}
      <div className="flex-none h-16 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] backdrop-blur-md flex items-center justify-between px-6 z-50 relative shadow-sm">
        {/* Left: App Title & Branding */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight">Performability Engine</h1>
            <span className="text-[10px] text-[var(--text-secondary)] font-medium tracking-wider uppercase">Section Layout Optimizer</span>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-[var(--border-subtle)] mx-2" />

          {/* Current Song Indicator */}
          {songName && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/30 border border-emerald-700/50 rounded-[var(--radius-sm)]">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-300">{songName}</span>
              <span className="text-[10px] text-emerald-500/70">(Auto-saving)</span>
            </div>
          )}

          <Link
            to="/"
            className="ml-4 px-3 py-1.5 text-xs font-semibold bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>

          <Link
            to={songId ? `/timeline?songId=${songId}` : '/timeline'}
            className="ml-2 px-3 py-1.5 text-xs font-semibold bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all"
          >
            Timeline View
          </Link>

          <Link
            to={songId ? `/event-analysis?songId=${songId}` : '/event-analysis'}
            className="ml-2 px-3 py-1.5 text-xs font-semibold bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all flex items-center gap-1.5"
            title="Open Event Analysis Page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Event Analysis
          </Link>

          {/* Dev-only: Cost Debug diagnostic view */}
          {SHOW_COST_DEBUG && (
            <Link
              to={songId ? `/cost-debug?songId=${songId}` : '/cost-debug'}
              className="ml-2 px-3 py-1.5 text-xs font-semibold bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all flex items-center gap-1.5"
              title="Open Cost Debug Page (Dev Only)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Cost Debug
            </Link>
          )}
        </div>

        {/* Right: Global Settings & Actions */}
        <div className="flex items-center gap-6">
          {/* Divider */}
          <div className="h-6 w-px bg-[var(--border-subtle)]" />

          {/* Settings Menu */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
              className={`p-2 text-[var(--text-secondary)]hover:text-[var(--text-primary)]transition-colors rounded-[var(--radius-sm)] ${settingsMenuOpen ? 'bg-[var(--bg-input)] text-[var(--text-primary)]' : ''
                } `}
              title="View Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>

            {/* Settings Dropdown Menu */}
            {settingsMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] shadow-lg z-50 py-2">
                <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                  <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">View Options</h3>
                </div>
                <div className="py-1">
                  <label className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-input)] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={showNoteLabels}
                      onChange={(e) => setShowNoteLabels(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--finger-L1)] focus:ring-[var(--finger-L1)] focus:ring-offset-0"
                    />
                    <span className="text-sm text-[var(--text-primary)]">Show Note Labels</span>
                  </label>
                  <label className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-input)] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={showPositionLabels}
                      onChange={(e) => setShowPositionLabels(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--finger-L1)] focus:ring-[var(--finger-L1)] focus:ring-offset-0"
                    />
                    <span className="text-sm text-[var(--text-primary)]">Show Position Labels</span>
                  </label>
                  <label className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-input)] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={showHeatmap}
                      onChange={(e) => setShowHeatmap(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--finger-L1)] focus:ring-[var(--finger-L1)] focus:ring-offset-0"
                    />
                    <span className="text-sm text-[var(--text-primary)]">Show Finger Assignment</span>
                  </label>
                </div>
                <div className="border-t border-[var(--border-subtle)] my-1" />
                <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                  <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Layout Options</h3>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleMapToQuadrants();
                      setSettingsMenuOpen(false);
                    }}
                    disabled={!projectState.instrumentConfig}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)] disabled:text-[var(--text-secondary)] disabled:cursor-not-allowed transition-colors"
                  >
                    Organize by 4x4 Banks
                  </button>
                  <div className="border-t border-[var(--border-subtle)] my-1" />
                  <button
                    onClick={() => {
                      handleDuplicateMapping();
                      setSettingsMenuOpen(false);
                    }}
                    disabled={!activeMapping}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-input)] disabled:text-[var(--text-secondary)] disabled:cursor-not-allowed transition-colors"
                  >
                    Duplicate Layout
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-[var(--border-subtle)]" />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Undo/Redo & Save/Load */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[var(--bg-input)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] p-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={!canUndo}
                title="Undo"
                className="p-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
              </Button>
              <div className="w-px h-4 bg-[var(--border-subtle)]"></div>
              <Button
                variant="ghost"
                size="sm"
                onClick={redo}
                disabled={!canRedo}
                title="Redo"
                className="p-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
              </Button>
            </div>

            <Button
              variant="success"
              size="sm"
              onClick={handleSaveProject}
            >
              Save Project
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadProjectInputRef.current?.click()}
            >
              Load
            </Button>
            <input
              ref={loadProjectInputRef}
              type="file"
              accept=".json"
              onChange={handleLoadProject}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area - 2 Column Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Background Ambient Glow */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900/5 to-slate-900 pointer-events-none z-0" />

        {/* Center: Pad Grid (Layout Designer) */}
        <div className="flex-1 relative z-10 flex flex-col min-w-0">
          {/* Toolbar / Breadcrumbs */}
          <div className="flex-none h-12 flex items-center justify-between px-6 border-b border-slate-800/50">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="font-semibold text-slate-200">Layout View</span>
              <span>/</span>
              <span>Grid Editor</span>
            </div>

            {/* Solver Controls */}
            <div className="flex items-center gap-3">
              {/* Clear Grid Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearGrid}
                disabled={!activeMapping || Object.keys(activeMapping.cells).length === 0}
                title="Clear all sounds from the grid"
                className="text-amber-500 hover:text-amber-400 hover:bg-amber-900/20"
              >
                Clear Grid
              </Button>

              <div className="h-6 w-px bg-slate-700/50" />

              {/* Primary layout: Seed (fill from Pose0), Natural (assign unassigned), Auto-Arrange (optimize). */}
              <div className="flex items-center gap-1.5">
                {/* Seed: fill mapping from Pose0 for full coverage (when grid empty or incomplete) */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSeedFromPose0}
                  disabled={!filteredPerformance || filteredPerformance.events.length === 0 || !hasNaturalPose}
                  title="Fill grid from Natural Hand Pose (deterministic). Use when grid is empty or has unmapped sounds."
                  leftIcon={(
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  )}
                >
                  Seed
                </Button>
                {/* Natural: assign sounds to Natural Hand Pose pads first (primary when pose is set) */}
                <Button
                  variant={hasNaturalPose ? "primary" : "secondary"}
                  size="sm"
                  onClick={handleAutoAssignNaturalPose}
                  disabled={!activeMapping || !hasNaturalPose || projectState.parkedSounds.filter(s => !Object.values(activeMapping.cells).some(c => c.id === s.id)).length === 0}
                  title={hasNaturalPose ? "Assign sounds to your Natural Hand Pose pads first (by importance). Use this to fill the grid from the library." : "Set your Natural Hand Pose in the Pose tab first, then use this to assign sounds to those pads."}
                  leftIcon={(
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                    </svg>
                  )}
                >
                  Natural
                </Button>

                {/* Auto-Arrange: optimize layout (respects Natural Hand Pose when set) */}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOptimizeLayout}
                  disabled={isOptimizingLayout || !activeMapping || !filteredPerformance || filteredPerformance.events.length === 0 || Object.keys(activeMapping?.cells || {}).length === 0}
                  isLoading={isOptimizingLayout}
                  title={hasNaturalPose ? "Optimize pad layout; prefers your Natural Hand Pose positions" : "Optimize pad layout using Simulated Annealing"}
                  leftIcon={!isOptimizingLayout && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                >
                  {isOptimizingLayout ? 'Optimizing...' : 'Auto-Arrange'}
                </Button>

                {/* Random: secondary option */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAutoAssignRandom}
                  disabled={!activeMapping || projectState.parkedSounds.filter(s => !Object.values(activeMapping.cells).some(c => c.id === s.id)).length === 0}
                  title="Randomly assign unassigned sounds to empty pads (secondary option)"
                  className="text-slate-400 hover:text-slate-200"
                  leftIcon={(
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                >
                  Random
                </Button>
              </div>

              <div className="h-6 w-px bg-slate-700/50" />

              {showAdvanced && (
                <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5 border border-slate-700/50">
                  <select
                    value={selectedSolver}
                    onChange={(e) => setSelectedSolver(e.target.value as SolverType)}
                    disabled={isRunningSolver}
                    className="bg-transparent border-none text-xs text-slate-200 focus:outline-none disabled:opacity-50 cursor-pointer"
                  >
                    <option value="beam">Beam Analysis</option>
                    <option value="genetic">Genetic Analysis</option>
                  </select>
                </div>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={handleRunSolver}
                disabled={isRunningSolver || !filteredPerformance || filteredPerformance.events.length === 0}
                isLoading={isRunningSolver}
                leftIcon={!isRunningSolver && (
                  <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              >
                {isRunningSolver ? 'Analyzing...' : 'Run Analysis'}
              </Button>

              {/* Progress bar for genetic solver */}
              {isRunningSolver && selectedSolver === 'genetic' && (
                <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${solverProgress}%` }}
                  />
                </div>
              )}

              {/* Solver result selector (Advanced only) */}
              {showAdvanced && projectState.solverResults && Object.keys(projectState.solverResults).length > 0 && (
                <>
                  <div className="h-6 w-px bg-slate-700/50" />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 font-medium">View Result:</label>
                    <select
                      value={projectState.activeSolverId || ''}
                      onChange={(e) => setActiveSolverId(e.target.value)}
                      className="bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {Object.keys(projectState.solverResults).map(solverId => (
                        <option key={solverId} value={solverId}>
                          {solverId === 'beam' ? 'Beam Search' :
                            solverId === 'genetic' ? 'Genetic Algorithm' :
                              solverId === 'annealing' ? 'Simulated Annealing' :
                                solverId}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Advanced toggle: Beam/Genetic comparison */}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${showAdvanced ? 'text-slate-200 bg-slate-800/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                title={showAdvanced ? 'Hide Beam/Genetic comparison' : 'Show Beam/Genetic comparison'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Advanced
              </button>
            </div>

          </div>

          {/* Grid Container */}
          <div className="flex-1 overflow-hidden flex items-center justify-center bg-[var(--bg-app)] relative">
            {/* Grid Background Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, var(--text-secondary) 1px, transparent 0)`,
                backgroundSize: '24px 24px'
              }}
            />

            {/* Empty State Message */}
            {!songId && projectState.parkedSounds.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/80 backdrop-blur-sm">
                <div className="text-center p-8 max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-2">No Song Selected</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Select a song from the Dashboard to start editing your pad layout.
                  </p>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Go to Dashboard
                  </Link>
                </div>
              </div>
            )}

            {/* Song has no MIDI linked message */}
            {songId && projectState.parkedSounds.length === 0 && hasLoadedSong && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/80 backdrop-blur-sm">
                <div className="text-center p-8 max-w-md">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-900/30 border-2 border-amber-600/50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-2">No MIDI Data</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    This song doesn't have any MIDI data linked yet. Go back to the Dashboard and use the "Link MIDI" button to add a MIDI file.
                  </p>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                    </svg>
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            )}

            <div className="w-full h-full flex flex-col">
              <LayoutDesigner
                parkedSounds={projectState.parkedSounds}
                activeMapping={activeMapping}
                instrumentConfig={projectState.instrumentConfig}
                onAssignSound={handleAssignSound}
                // onAssignSounds={handleAssignSounds}
                onUpdateMapping={handleUpdateMapping}
                // onDuplicateMapping={handleDuplicateMapping}
                onAddSound={handleAddSound}
                onUpdateSound={handleUpdateSound}
                onUpdateMappingSound={handleUpdateMappingSound}
                onRemoveSound={handleRemoveSound}
                onDeleteSound={handleDeleteSound}
                projectState={projectState}
                onUpdateProjectState={setProjectState}
                // onSetActiveMappingId={setActiveMappingId}
                activeLayout={activeLayout}
                showNoteLabels={showNoteLabels}
                showPositionLabels={showPositionLabels}
                // showHeatmap={showHeatmap}
                engineResult={engineResult}
              // Explicit layout control callbacks
              // onOptimizeLayout={handleOptimizeLayout}
              // onSaveLayoutVersion={handleSaveLayoutVersion}
              // onRequestMapToQuadrants={handleMapToQuadrants}
              />
            </div>
          </div>

        </div>

        {/* Right: Analysis Panel */}
        <div className="w-96 flex-none z-20 relative shadow-2xl shadow-black/50">
          <AnalysisPanel
            engineResult={engineResult}
            activeMapping={activeMapping}
            performance={filteredPerformance}
            onAssignmentChange={handleAssignmentChange}
            showAdvanced={showAdvanced}
          />
        </div>
      </div>
    </div>
  );
};
