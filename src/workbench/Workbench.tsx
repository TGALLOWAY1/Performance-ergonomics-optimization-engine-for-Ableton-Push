import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { LayoutDesigner } from './LayoutDesigner';
import { GridMapping, Voice } from '../types/layout';
import { InstrumentConfig } from '../types/performance';
import { ProjectState } from '../types/projectState';
import { generateId } from '../utils/performanceUtils';
import { fetchMidiProject, parseMidiFileToProject } from '../utils/midiImport';
import { BiomechanicalSolver } from '../engine/core';
import { FingerType } from '../engine/models';
import { getActivePerformance } from '../utils/performanceSelectors';
import { AnalysisPanel } from './AnalysisPanel';
import { ThemeToggle } from '../components/ThemeToggle';


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
  } = useProject();

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

  // View Settings state
  const [showNoteLabels, setShowNoteLabels] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Engine state


  // Timeline state
  const filteredPerformance = useMemo(() => getActivePerformance(projectState), [projectState]);


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
        const updatedMappings = [projectData.gridMapping];

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
      const solver = new BiomechanicalSolver(projectData.instrumentConfig, projectData.gridMapping);
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

        const solver = new BiomechanicalSolver(projectState.instrumentConfig, activeMapping);
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
  const handleAssignSound = (cellKey: string, sound: Voice) => {
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
            to="/timeline"
            className="ml-2 px-3 py-1.5 text-xs font-semibold bg-[var(--bg-card)] hover:brightness-110 text-[var(--text-primary)] rounded-[var(--radius-sm)] border border-[var(--border-subtle)] transition-all"
          >
            Timeline View
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

            {/* View Toggles */}
            <div className="flex items-center gap-3 bg-slate-800/30 rounded-full px-1 py-1 border border-slate-700/30">
              <button
                onClick={() => setShowNoteLabels(!showNoteLabels)}
                className={`px-3 py-1 text-xs rounded-full transition-all ${showNoteLabels ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Notes
              </button>
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`px-3 py-1 text-xs rounded-full transition-all ${showHeatmap ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Heatmap
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
                onImport={(file) => handleProjectLoad(file, projectState.instrumentConfig)}
                onUpdateMappingSound={handleUpdateMappingSound}
                onRemoveSound={handleRemoveSound}
                onDeleteSound={handleDeleteSound}
                projectState={projectState}
                onUpdateProjectState={setProjectState}
                onSetActiveMappingId={setActiveMappingId}
                activeLayout={activeLayout}
                showNoteLabels={showNoteLabels}
                showHeatmap={showHeatmap}
                engineResult={engineResult}
              />
            </div>
          </div>

          {/* Bottom Status Bar (Ergonomic Score) */}
          <div className="flex-none h-12 glass-panel border-t border-slate-700/50 flex items-center justify-center px-6">
            {engineResult ? (
              <div className="flex items-center gap-3 px-4 py-1.5 bg-slate-800/80 rounded-full border border-slate-700 shadow-lg">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Section Ergonomic Score:</span>
                <span className={`text-sm font-bold ${engineResult.score >= 0.8 ? 'text-emerald-400' :
                  engineResult.score >= 0.6 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                  {engineResult.score.toFixed(2)}
                  <span className="text-xs font-normal opacity-70 ml-1">
                    ({engineResult.score >= 0.8 ? 'Excellent' : engineResult.score >= 0.6 ? 'Good' : 'Poor'})
                  </span>
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Waiting for analysis...</span>
            )}
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
