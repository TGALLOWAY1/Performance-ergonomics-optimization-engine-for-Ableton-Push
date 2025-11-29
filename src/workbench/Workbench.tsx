import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { LayoutDesigner } from './LayoutDesigner';
import { GridMapping, Voice, LayoutMode, cellKey } from '../types/layout';
import { InstrumentConfig } from '../types/performance';
import { ProjectState } from '../types/projectState';
import { generateId } from '../utils/performanceUtils';
import { fetchMidiProject, parseMidiFileToProject } from '../utils/midiImport';
import { BiomechanicalSolver, SolverType } from '../engine/core';
import { FingerType } from '../engine/models';
import { getActivePerformance } from '../utils/performanceSelectors';
import { AnalysisPanel } from './AnalysisPanel';
import { ThemeToggle } from '../components/ThemeToggle';
import { songService } from '../services/SongService';


export const Workbench: React.FC = () => {
  const {
    projectState,
    setProjectState,
    undo,
    redo,
    canUndo,
    canRedo,
    engineResult,
    setEngineResult,
    runSolver,
    setActiveSolverId,
    getSolverResult,
  } = useProject();

  const [searchParams] = useSearchParams();
  const songId = searchParams.get('songId');
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [songName, setSongName] = useState<string | null>(null);
  const [hasLoadedSong, setHasLoadedSong] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [activeMappingId, setActiveMappingId] = useState<string | null>(null);

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
        setActiveMappingId(mappings[0].id);
      }
    } else if (currentId !== null) {
      // Clear selection if no mappings
      setActiveMappingId(null);
    }
  }, [projectState.mappings]);

  // Track if we've already attempted to load this session to prevent double-loading
  const hasAttemptedLoadRef = useRef(false);
  const loadedSongIdRef = useRef<string | null>(null);
  
  // Load song state when navigating from Dashboard with a songId
  // This effect runs on mount and when songId changes
  useEffect(() => {
    if (!songId) return;
    
    // Prevent double-loading the same song in the same session
    if (hasAttemptedLoadRef.current && loadedSongIdRef.current === songId) {
      console.log('[Workbench] Already loaded this song in session, skipping');
      return;
    }
    
    // Get song metadata for display
    const song = songService.getSong(songId);
    if (song) {
      setSongName(song.metadata.title);
    }
    
    // Check which song was last loaded (persists across page refresh)
    const lastLoadedSongId = localStorage.getItem('workbench_current_song_id');
    const isSameSong = lastLoadedSongId === songId;
    
    // Check if the current projectState has MEANINGFUL data (not just the default initial state)
    // Check for performance events (MIDI data), voices, AND mapping cells
    const hasPerformanceEvents = projectState.layouts.some(l => l.performance?.events?.length > 0);
    const hasVoices = projectState.parkedSounds.length > 0;
    const hasMappingCells = projectState.mappings.some(m => Object.keys(m.cells).length > 0);
    const hasRealData = hasPerformanceEvents || hasVoices || hasMappingCells;
    
    // ALWAYS load from storage when:
    // 1. Different song than last time (user switched songs), OR
    // 2. Same song but no real data in context (page refresh / initial load)
    const shouldLoad = !isSameSong || !hasRealData;
    
    console.log('[Workbench] Song load check:', { 
      songId, 
      lastLoadedSongId, 
      isSameSong, 
      hasPerformanceEvents,
      hasVoices,
      hasMappingCells,
      hasRealData,
      shouldLoad,
      hasAttemptedLoad: hasAttemptedLoadRef.current,
    });
    
    // Mark that we've attempted to load
    hasAttemptedLoadRef.current = true;
    loadedSongIdRef.current = songId;
    
    if (shouldLoad) {
      console.log('[Workbench] Loading song state for:', songId);
      
      // Save the current song ID to localStorage
      localStorage.setItem('workbench_current_song_id', songId);
      setCurrentSongId(songId);
      
      const savedState = songService.loadSongState(songId);
      if (savedState) {
        console.log('[Workbench] Loaded saved project state:', {
          layoutsCount: savedState.layouts.length,
          parkedSoundsCount: savedState.parkedSounds.length,
          mappingsCount: savedState.mappings.length,
          mappingCells: savedState.mappings.map(m => Object.keys(m.cells).length),
          voiceNames: savedState.parkedSounds.map(v => v.name),
          performanceEventsCount: savedState.layouts[0]?.performance?.events?.length || 0,
        });
        
        // Set the project state from the saved state
        setProjectState(savedState, true); // Skip history for initial load
        
        // Set active mapping if available
        if (savedState.mappings.length > 0) {
          setActiveMappingId(savedState.mappings[0].id);
        }
      } else {
        console.log('[Workbench] No saved state found for song:', songId);
      }
      
      setHasLoadedSong(true);
    } else {
      console.log('[Workbench] Using existing data in context (navigation back from Timeline)');
      setCurrentSongId(songId);
      setHasLoadedSong(true);
    }
  }, [songId, setProjectState, projectState]); // Added projectState to properly track when data is loaded

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

  // Solver control state
  const [selectedSolver, setSelectedSolver] = useState<SolverType>('beam');
  const [isRunningSolver, setIsRunningSolver] = useState(false);
  const [solverProgress, setSolverProgress] = useState(0);

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
      // For genetic solver, simulate progress updates
      if (selectedSolver === 'genetic') {
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
        
        await runSolver(selectedSolver, activeMapping);
        
        clearInterval(progressInterval);
        setSolverProgress(100);
        
        // Set as active solver
        setActiveSolverId(selectedSolver);
      } else {
        // Beam solver is fast, no progress needed
        await runSolver(selectedSolver, activeMapping);
        setActiveSolverId(selectedSolver);
        setSolverProgress(100);
      }
    } catch (error) {
      console.error('[Workbench] Solver execution failed:', error);
      alert(`Solver execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunningSolver(false);
      setTimeout(() => setSolverProgress(0), 1000); // Reset progress after 1s
    }
  }, [selectedSolver, filteredPerformance, activeMapping, runSolver, setActiveSolverId]);


  /**
   * Unified project load handler that processes MIDI files and updates project state atomically.
   * This function handles both default loading and user file imports.
   * 
   * @param source - Either a File object or a URL string
   * @param existingConfig - Optional existing instrument config to use as base
   */
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

      // Always set active mapping ID to the new mapping (hard reset)
      setActiveMappingId(projectData.gridMapping.id);

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
  }, [setProjectState, activeMappingId, setActiveMappingId]);

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

  // Reactive Solver Loop: Automatically run engine when layout changes
  // Watches: activeMapping, activeLayout.performance, activeSection.instrumentConfig, ignoredNoteNumbers
  useEffect(() => {
    // Get filtered performance (excludes ignored notes)
    const filteredPerformance = getActivePerformance(projectState);

    // Early exit conditions
    // Debounce engine execution (300ms) to avoid crashing browser during rapid drag operations
    const timer = setTimeout(() => {
      try {
        // Run solver with project instrument config and active mapping
        if (!filteredPerformance) return;

        // Get manual assignments for current layout
        const currentLayoutId = projectState.activeLayoutId;
        const manualAssignments = currentLayoutId && projectState.manualAssignments
          ? projectState.manualAssignments[currentLayoutId]
          : undefined;

        // Convert string keys to numbers for the engine
        const parsedAssignments: Record<number, { hand: 'left' | 'right', finger: FingerType }> = {};
        if (manualAssignments) {
          Object.entries(manualAssignments).forEach(([key, value]) => {
            parsedAssignments[parseInt(key, 10)] = value;
          });
        }

        // Create solver with instrument config, grid mapping, and engine configuration
        const solver = new BiomechanicalSolver(
          projectState.instrumentConfig, 
          activeMapping,
          undefined, // Use default engine constants
          projectState.engineConfiguration
        );
        const result = solver.solve(filteredPerformance, parsedAssignments);

        // DEBUG: Log engine result to verify finger assignments
        console.log('[Workbench] Engine result generated:', {
          score: result.score,
          hardCount: result.hardCount,
          unplayableCount: result.unplayableCount,
          debugEventsCount: result.debugEvents.length,
          fingerUsageStats: result.fingerUsageStats,
          fatigueMap: result.fatigueMap,
          averageDrift: result.averageDrift,
          sampleDebugEvents: result.debugEvents.slice(0, 5), // First 5 events
          playableEventsCount: result.debugEvents.filter(e => e.assignedHand !== 'Unplayable').length,
        });

        // DIAGNOSTIC: If all events are unplayable, log why
        if (result.unplayableCount === result.debugEvents.length && result.debugEvents.length > 0) {
          console.warn('⚠️ [Workbench] ALL events are Unplayable! This means:');
          console.warn('  1. No sounds have been assigned to grid cells, OR');
          console.warn('  2. Grid mapping doesn\'t match MIDI note numbers, OR');
          console.warn('  3. Instrument config is incorrect');

          // Detailed diagnostics
          console.group('📊 Diagnostic Information:');
          console.log('Active mapping cells:', Object.keys(activeMapping?.cells || {}).length);
          console.log('Sample event note numbers:', result.debugEvents.slice(0, 5).map(e => e.noteNumber));

          // Show what's in the grid mapping
          if (activeMapping) {
            const gridNoteNumbers = Object.values(activeMapping.cells).map(c => c.originalMidiNote).filter(n => n !== null);
            console.log('Grid has notes:', gridNoteNumbers);
            console.log('Grid cells:', Object.entries(activeMapping.cells).slice(0, 5).map(([key, sound]) => ({
              cellKey: key,
              soundName: sound.name,
              midiNote: sound.originalMidiNote,
            })));
          }

          console.log('Instrument config:', {
            name: projectState.instrumentConfig.name,
            bottomLeftNote: projectState.instrumentConfig.bottomLeftNote,
            layoutMode: projectState.instrumentConfig.layoutMode,
          });

          console.groupEnd();
        }
        setEngineResult(result);

        // Update scoreCache in the mapping for quick reference
        setProjectState(prevState => ({
          ...prevState,
          mappings: prevState.mappings.map(m =>
            activeMapping && m.id === activeMapping.id
              ? { ...m, scoreCache: result.score }
              : m
          ),
        }));
      } catch (err) {
        console.error('[Workbench] Engine execution failed:', err);
        setEngineResult(null);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [
    activeMapping?.id,
    activeMapping?.cells, // Watch for cell changes (pad swaps/assignments)
    activeLayout?.performance.events, // Watch for performance changes
    projectState.instrumentConfig, // Watch for config changes
    projectState.ignoredNoteNumbers, // Watch for voice visibility changes
    projectState.engineConfiguration, // Watch for engine configuration changes
    projectState, // Include full state for getActivePerformance selector
  ]);

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
      });
      // Set activeMappingId immediately to ensure it's available
      setActiveMappingId(newMapping.id);
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

  const handleAssignSounds = (assignments: Record<string, Voice>) => {
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

  const handleAssignmentChange = (index: number, hand: 'left' | 'right', finger: FingerType) => {
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
            [index]: { hand, finger }
          }
        }
      };
    });
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
  // EXPLICIT LAYOUT CONTROL: Optimize Layout
  // ============================================================================
  // Runs the biomechanical solver to find an optimal layout.
  // IMPORTANT: This OVERWRITES the current layout with the optimized result.
  // Only runs when explicitly triggered by user clicking "Optimize Layout" button.
  // ============================================================================
  const handleOptimizeLayout = useCallback(() => {
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

    console.log('[Workbench] Starting layout optimization...');

    try {
      // Run the biomechanical solver with current configuration
      const solver = new BiomechanicalSolver(
        projectState.instrumentConfig,
        activeMapping,
        undefined,
        projectState.engineConfiguration
      );

      // Get manual assignments for current layout
      const currentLayoutId = projectState.activeLayoutId;
      const manualAssignments = currentLayoutId && projectState.manualAssignments
        ? projectState.manualAssignments[currentLayoutId]
        : undefined;

      // Convert string keys to numbers for the engine
      const parsedAssignments: Record<number, { hand: 'left' | 'right', finger: FingerType }> = {};
      if (manualAssignments) {
        Object.entries(manualAssignments).forEach(([key, value]) => {
          parsedAssignments[parseInt(key, 10)] = value;
        });
      }

      const result = solver.solve(performance, parsedAssignments);

      console.log('[Workbench] Optimization complete:', {
        score: result.score,
        hardCount: result.hardCount,
        unplayableCount: result.unplayableCount,
      });

      // For now, we don't actually rearrange the pads - we just mark the layout as "optimized"
      // A full optimization would require implementing a layout search algorithm
      // that tries different pad arrangements and scores them.
      //
      // TODO: Implement full layout optimization that:
      // 1. Generates candidate layouts (permutations of pad assignments)
      // 2. Scores each with the biomechanical solver
      // 3. Picks the best one
      //
      // For now, we mark as "optimized" to indicate the user has run the optimization,
      // even though the actual optimization algorithm is not yet implemented.

      // Update mapping with layoutMode: 'optimized'
      setProjectState(prevState => ({
        ...prevState,
        mappings: prevState.mappings.map(m =>
          activeMapping && m.id === activeMapping.id
            ? { 
                ...m, 
                layoutMode: 'optimized' as LayoutMode,
                scoreCache: result.score,
              }
            : m
        ),
      }));

      // Update engine result
      setEngineResult(result);

      alert(`Layout optimization complete!\n\nScore: ${(result.score * 100).toFixed(1)}%\nHard transitions: ${result.hardCount}\nUnplayable: ${result.unplayableCount}\n\n(Note: Full layout rearrangement is not yet implemented. Layout marked as "optimized".)`);

    } catch (err) {
      console.error('[Workbench] Optimization failed:', err);
      alert('Layout optimization failed. See console for details.');
    }
  }, [activeMapping, projectState, setProjectState, setEngineResult]);

  // ============================================================================
  // EXPLICIT LAYOUT CONTROL: Save Layout Version
  // ============================================================================
  // Saves the current layout as a new version (snapshot).
  // This is for versioning, not basic persistence (autosave handles that).
  // ============================================================================
  const handleSaveLayoutVersion = useCallback(() => {
    if (!activeMapping) {
      alert('No active mapping to save.');
      return;
    }

    if (Object.keys(activeMapping.cells).length === 0) {
      alert('Cannot save an empty layout. Please assign some sounds first.');
      return;
    }

    // Increment version number
    const currentVersion = activeMapping.version || 0;
    const newVersion = currentVersion + 1;

    console.log(`[Workbench] Saving layout version ${newVersion}...`);

    // Update the mapping with new version info
    setProjectState(prevState => ({
      ...prevState,
      mappings: prevState.mappings.map(m =>
        activeMapping && m.id === activeMapping.id
          ? {
              ...m,
              version: newVersion,
              savedAt: new Date().toISOString(),
            }
          : m
      ),
    }));

    // The autosave mechanism will persist this change automatically

    alert(`Layout saved as version ${newVersion}.\n\nAutosave will persist this to storage.`);

    console.log(`[Workbench] Layout version ${newVersion} saved successfully.`);
  }, [activeMapping, setProjectState]);



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

          {/* Song Section Selector (Mockup Style) */}
          <div className="flex items-center gap-2 bg-[var(--bg-input)] rounded-[var(--radius-sm)] p-1 border border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-secondary)] pl-2">Song Section:</span>
            <select className="bg-transparent text-sm font-semibold text-[var(--text-primary)] focus:outline-none cursor-pointer py-1 pr-2">
              <option>DROP A</option>
              <option>DROP B</option>
              <option>VERSE 1</option>
              <option>CHORUS 1</option>
            </select>
          </div>

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
        </div>

        {/* Right: Global Settings & Actions */}
        <div className="flex items-center gap-6">
          {/* Status Indicators */}
          <div className="flex items-center gap-4 text-xs font-medium text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <span>Auto-Map Enabled</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <span>Ergonomic Scoring: ON</span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-[var(--border-subtle)]" />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Undo/Redo & Save/Load */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[var(--bg-input)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] p-0.5">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Undo"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
              </button>
              <div className="w-px h-4 bg-[var(--border-subtle)]"></div>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Redo"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
              </button>
            </div>

            <button
              onClick={handleSaveProject}
              className="px-4 py-2 text-xs font-semibold bg-[var(--finger-L1)] hover:brightness-110 text-white rounded-[var(--radius-sm)] shadow-lg transition-all"
            >
              Save Project
            </button>
            <button
              onClick={() => loadProjectInputRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all"
            >
              Load
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
              <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5 border border-slate-700/50">
                <label className="text-xs text-slate-400 font-medium">Optimization Model:</label>
                <select
                  value={selectedSolver}
                  onChange={(e) => setSelectedSolver(e.target.value as SolverType)}
                  disabled={isRunningSolver}
                  className="bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="beam">Beam Search (Fast)</option>
                  <option value="genetic">Genetic Algorithm (Deep)</option>
                </select>
              </div>

              <button
                onClick={handleRunSolver}
                disabled={isRunningSolver || !filteredPerformance || filteredPerformance.events.length === 0}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-2"
              >
                {isRunningSolver ? (
                  <>
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Running...
                  </>
                ) : (
                  'Run Optimization'
                )}
              </button>

              {/* Progress bar for genetic solver */}
              {isRunningSolver && selectedSolver === 'genetic' && (
                <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${solverProgress}%` }}
                  />
                </div>
              )}

              {/* Solver result selector */}
              {projectState.solverResults && Object.keys(projectState.solverResults).length > 0 && (
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
                          {solverId === 'beam' ? 'Beam Search' : solverId === 'genetic' ? 'Genetic Algorithm' : solverId}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* View Toggles */}
            <div className="flex items-center gap-3 bg-slate-800/30 rounded-full px-1 py-1 border border-slate-700/30">
              <button
                onClick={() => setShowNoteLabels(!showNoteLabels)}
                className={`px-3 py-1 text-xs rounded-full transition-all ${showNoteLabels ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Notes
              </button>
              <button
                onClick={() => setShowPositionLabels(!showPositionLabels)}
                className={`px-3 py-1 text-xs rounded-full transition-all ${showPositionLabels ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Pos
              </button>
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`px-3 py-1 text-xs rounded-full transition-all ${showHeatmap ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Finger Assignment
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
                showNoteLabels={showNoteLabels}
                showPositionLabels={showPositionLabels}
                showHeatmap={showHeatmap}
                engineResult={engineResult}
                // Explicit layout control callbacks
                onOptimizeLayout={handleOptimizeLayout}
                onSaveLayoutVersion={handleSaveLayoutVersion}
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
          />
        </div>
      </div>
    </div>
  );
};
