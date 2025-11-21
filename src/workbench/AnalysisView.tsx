import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { GridArea } from './GridArea';
import { TimelineArea } from './TimelineArea';
import { EngineResultsPanel } from './EngineResultsPanel';
import { ProjectState, LayoutSnapshot } from '../types/projectState';
import { InstrumentConfig } from '../data/models';
import { GridPattern } from '../types/gridPattern';
import { createEmptyPattern, toggleStepPad } from '../utils/gridPatternUtils';
import { gridPatternToPerformance, performanceToGridPattern } from '../utils/gridPatternToPerformance';
import { parseMidiFile } from '../utils/midiImport';
import { GridMapService } from '../engine/gridMapService';
import { getSnakePattern, getCornersPattern, getRangeTestPattern, getKillaArp, getDrumBeat } from '../utils/debugPatterns';
import { runEngine, EngineResult } from '../engine/runEngine';
import { GridMapping } from '../types/layout';
import { getPositionForMidi } from '../utils/layoutUtils';
import { exportLayout, importLayout } from '../utils/projectPersistence';

interface AnalysisViewProps {
  /** Current project state */
  projectState: ProjectState;
  /** Active layout snapshot */
  activeLayout: LayoutSnapshot | null;
  /** Active mapping for analysis */
  activeMapping: GridMapping | null;
  /** Callback to update project state */
  onUpdateProjectState: (state: ProjectState) => void;
  /** Callback to update the active mapping */
  onUpdateMapping: (updates: Partial<GridMapping>) => void;
  /** Callback to set the active mapping ID */
  onSetActiveMappingId?: (id: string) => void;
}

/**
 * AnalysisView component - The 3-pane layout for analyzing performances.
 * Extracted from Workbench to separate analysis mode from designer mode.
 */
export const AnalysisView: React.FC<AnalysisViewProps> = ({
  projectState,
  activeLayout,
  activeMapping,
  onUpdateProjectState,
  onUpdateMapping,
  onSetActiveMappingId,
}) => {
  // Note: We don't block the entire view - sidebar should always be visible for importing layouts

  // Local state for the grid pattern (step sequencer)
  const [gridPatterns, setGridPatterns] = useState<Record<string, GridPattern>>(() => {
    const patterns: Record<string, GridPattern> = {};
    projectState.layouts.forEach(layout => {
      patterns[layout.id] = createEmptyPattern(64);
    });
    return patterns;
  });
  
  const [currentStep, setCurrentStep] = useState(0);
  const [showDebugLabels, setShowDebugLabels] = useState(false);
  const [viewAllSteps, setViewAllSteps] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false); // ADD THIS LINE
  const [showNoteLabels, setShowNoteLabels] = useState(false); // ADD THIS LINE (if separate from debug labels)
  const [engineResult, setEngineResult] = useState<EngineResult | null>(null);
  const [highlightedCell, setHighlightedCell] = useState<{ row: number; col: number } | null>(null);
  const importLayoutInputRef = React.useRef<HTMLInputElement>(null);

  const activeSection = useMemo(() => 
    projectState.sectionMaps[0] || null, // Simplified: just take first section for now
    [projectState.sectionMaps]
  );

  const activeGridPattern = useMemo(() => 
    (projectState.activeLayoutId && gridPatterns[projectState.activeLayoutId]) || createEmptyPattern(64),
    [gridPatterns, projectState.activeLayoutId]
  );

  // W5: Bidirectional Sync - Performance → GridPattern
  // When Performance changes, update GridPattern using the active InstrumentConfig
  useEffect(() => {
    if (!activeLayout || !activeSection || !projectState.activeLayoutId) return;
    
    // Convert Performance to GridPattern using the active InstrumentConfig
    const syncedPattern = performanceToGridPattern(
      activeLayout.performance,
      activeSection.instrumentConfig,
      activeLayout.performance.tempo || projectState.projectTempo,
      64
    );
    
    // Update GridPattern state (this will trigger re-render but won't cause loop since we're not reading gridPatterns in deps)
    setGridPatterns(prev => {
      const currentPattern = prev[projectState.activeLayoutId!];
      // Only update if pattern actually changed (avoid unnecessary updates)
      if (currentPattern && JSON.stringify(currentPattern.steps) === JSON.stringify(syncedPattern.steps)) {
        return prev;
      }
      return {
        ...prev,
        [projectState.activeLayoutId!]: syncedPattern
      };
    });
  }, [activeLayout?.performance.events, activeLayout?.performance.tempo, activeSection?.instrumentConfig, projectState.activeLayoutId, projectState.projectTempo]);

  // Engine Integration Effect
  useEffect(() => {
    if (!activeLayout || !activeMapping) return;

    const timer = setTimeout(() => {
      const result = runEngine(activeLayout.performance, activeMapping);
      setEngineResult(result);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [activeLayout, activeMapping]);

  const handleCreateLayout = () => {
    const newId = `layout-${Date.now()}`;
    const newLayout: LayoutSnapshot = {
      id: newId,
      name: `Layout ${projectState.layouts.length + 1}`,
      createdAt: new Date().toISOString(),
      performance: {
        events: [],
        tempo: projectState.projectTempo,
        name: 'New Performance'
      }
    };
    
    setGridPatterns(prev => ({
      ...prev,
      [newId]: createEmptyPattern(64)
    }));

    onUpdateProjectState({
      ...projectState,
      layouts: [...projectState.layouts, newLayout],
      activeLayoutId: newId
    });
  };

  const handleDeleteLayout = (id: string) => {
    const newLayouts = projectState.layouts.filter(l => l.id !== id);
    let newActiveId = projectState.activeLayoutId;
    if (projectState.activeLayoutId === id) {
      newActiveId = newLayouts.length > 0 ? newLayouts[0].id : null;
    }
    
    onUpdateProjectState({
      ...projectState,
      layouts: newLayouts,
      activeLayoutId: newActiveId
    });
    
    setGridPatterns(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSelectLayout = (id: string) => {
    onUpdateProjectState({ ...projectState, activeLayoutId: id });
  };

  const handleUpdateSection = (id: string, updates: Partial<SectionMap> | { field: 'startMeasure' | 'lengthInMeasures' | 'bottomLeftNote'; value: number }) => {
    onUpdateProjectState({
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
             mappings: Array.isArray(parsed.mappings) ? parsed.mappings : []
           };
           onUpdateProjectState(loadedState);
           // Reset grid patterns on load (or we'd need to save them too)
           // For now, just re-init empty patterns for loaded layouts
           const newPatterns: Record<string, GridPattern> = {};
           parsed.layouts.forEach((l: LayoutSnapshot) => {
             newPatterns[l.id] = createEmptyPattern(64);
           });
           setGridPatterns(newPatterns);
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

  const handleImportMidi = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeSection) return;

    try {
      // W3: Get import result with unmapped note count
      const importResult = await parseMidiFile(file, activeSection.instrumentConfig);
      const performance = importResult.performance;
      
      // Intelligent Root Note Logic: Auto-set bottomLeftNote to minimum note
      let updatedProjectState = { ...projectState };
      if (importResult.minNoteNumber !== null) {
        // Update the active section's instrument config
        const updatedSectionMaps = projectState.sectionMaps.map(section => {
          if (section.id === activeSection.id) {
            return {
              ...section,
              instrumentConfig: {
                ...section.instrumentConfig,
                bottomLeftNote: importResult.minNoteNumber!
              }
            };
          }
          return section;
        });

        // Also update the instrument config in the instrumentConfigs array
        const updatedInstrumentConfigs = projectState.instrumentConfigs.map(config => {
          if (config.id === activeSection.instrumentConfig.id) {
            return {
              ...config,
              bottomLeftNote: importResult.minNoteNumber!
            };
          }
          return config;
        });

        updatedProjectState = {
          ...projectState,
          sectionMaps: updatedSectionMaps,
          instrumentConfigs: updatedInstrumentConfigs
        };
      }
      
      // W3: Show warning if there are unmapped notes (should be 0 after auto-adjustment)
      if (importResult.unmappedNoteCount > 0) {
        console.warn(
          `Warning: ${importResult.unmappedNoteCount} note${importResult.unmappedNoteCount === 1 ? '' : 's'} in the MIDI file fall outside the 8x8 grid window. ` +
          `Root note auto-adjusted to ${importResult.minNoteNumber !== null ? importResult.minNoteNumber : activeSection.instrumentConfig.bottomLeftNote} to fit all notes.`
        );
      }
      
      // Create a new layout for the imported MIDI
      const newId = `layout-${Date.now()}`;
      const newLayout: LayoutSnapshot = {
        id: newId,
        name: performance.name || 'Imported MIDI',
        createdAt: new Date().toISOString(),
        performance: performance
      };

      // W5: Convert Performance to GridPattern using the updated InstrumentConfig
      const updatedConfig = updatedProjectState.sectionMaps.find(s => s.id === activeSection.id)?.instrumentConfig || activeSection.instrumentConfig;
      const newPattern = performanceToGridPattern(
        performance,
        updatedConfig,
        performance.tempo || updatedProjectState.projectTempo,
        64
      );

      setGridPatterns(prev => ({
        ...prev,
        [newId]: newPattern
      }));

      onUpdateProjectState({
        ...updatedProjectState,
        layouts: [...updatedProjectState.layouts, newLayout],
        activeLayoutId: newId,
        projectTempo: performance.tempo || updatedProjectState.projectTempo
      });

    } catch (err) {
      console.error(err);
      alert("Failed to import MIDI file");
    }
    
    event.target.value = '';
  };

  const handleTogglePad = (step: number, row: number, col: number) => {
    if (!projectState.activeLayoutId || !activeSection) return;

    const currentPattern = gridPatterns[projectState.activeLayoutId] || createEmptyPattern(64);
    const newPattern = toggleStepPad(currentPattern, step, row, col);

    // Update Grid Pattern State
    setGridPatterns(prev => ({
      ...prev,
      [projectState.activeLayoutId!]: newPattern
    }));

    // W5: Convert GridPattern to Performance using the active InstrumentConfig
    const newPerformance = gridPatternToPerformance(
      newPattern,
      activeSection.instrumentConfig,
      projectState.projectTempo
    );

    onUpdateProjectState({
      ...projectState,
      layouts: projectState.layouts.map(l => {
        if (l.id !== projectState.activeLayoutId) return l;
        return {
          ...l,
          performance: newPerformance
        };
      })
    });
  };

  const loadDebugPattern = (patternType: 'snake' | 'corners' | 'range' | 'arp' | 'drum') => {
    if (!projectState.activeLayoutId || !activeSection) return;

    let performance;
    switch (patternType) {
      case 'snake':
        performance = getSnakePattern();
        break;
      case 'corners':
        performance = getCornersPattern();
        break;
      case 'range':
        performance = getRangeTestPattern();
        break;
      case 'arp':
        performance = getKillaArp();
        break;
      case 'drum':
        performance = getDrumBeat();
        break;
    }

    // Convert Performance to GridPattern
    const newPattern = createEmptyPattern(64);
    const stepDuration = (60 / performance.tempo!) / 4;

    performance.events.forEach(event => {
      const stepIndex = Math.round(event.startTime / stepDuration);
      if (stepIndex >= 0 && stepIndex < newPattern.length) {
        // Use activeMapping if available, otherwise fall back to InstrumentConfig
        const pos = activeMapping
          ? getPositionForMidi(event.noteNumber, activeMapping)
          : GridMapService.getPositionForNote(event.noteNumber, activeSection.instrumentConfig);
        if (pos) {
          if (!newPattern.steps[stepIndex][pos.row][pos.col]) {
             newPattern.steps[stepIndex][pos.row][pos.col] = true;
          }
        }
      }
    });

    setGridPatterns(prev => ({
      ...prev,
      [projectState.activeLayoutId!]: newPattern
    }));

    onUpdateProjectState({
      ...projectState,
      layouts: projectState.layouts.map(l => {
        if (l.id !== projectState.activeLayoutId) return l;
        return {
          ...l,
          performance: performance
        };
      })
    });
  };

  const handleResetPattern = () => {
    if (!projectState.activeLayoutId) return;
    
    setGridPatterns(prev => ({
      ...prev,
      [projectState.activeLayoutId!]: createEmptyPattern(64)
    }));

    onUpdateProjectState({
      ...projectState,
      layouts: projectState.layouts.map(l => {
        if (l.id !== projectState.activeLayoutId) return l;
        return {
          ...l,
          performance: {
            events: [],
            tempo: projectState.projectTempo,
            name: l.performance.name
          }
        };
      })
    });
  };

  const handleExportLayout = () => {
    if (!activeMapping) {
      alert('No layout mapping to export. Please create or select a layout first.');
      return;
    }
    exportLayout(activeMapping, projectState.parkedSounds);
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

  return (
    <div className="flex-1 flex flex-row overflow-hidden">
      {/* Left Panel (Sidebar) */}
      <div className="w-64 flex-none border-r border-gray-700 overflow-y-auto">
        <Sidebar 
          layouts={projectState.layouts}
          activeLayoutId={projectState.activeLayoutId}
          sectionMaps={projectState.sectionMaps}
          onSelectLayout={handleSelectLayout}
          onCreateLayout={handleCreateLayout}
          onDeleteLayout={handleDeleteLayout}
          onUpdateSection={handleUpdateSection}
          onSaveProject={handleSaveProject}
          onLoadProject={handleLoadProject}
          onImportMidi={handleImportMidi}
          onExportLayout={handleExportLayout}
          onImportLayout={handleImportLayout}
        />
      </div>

      {/* Center Panel (Stage) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Analysis Toolbar */}
        <div className="flex-none h-10 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-4">
          <div className="flex items-center gap-1 border border-slate-700 rounded p-1">
            <button
              onClick={handleExportLayout}
              disabled={!activeMapping}
              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded transition-colors"
              title={!activeMapping ? 'No active layout to export' : 'Export Current Layout'}
            >
              Export Layout
            </button>
            <button
              onClick={() => importLayoutInputRef.current?.click()}
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

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex items-center gap-4">
            <label className="text-xs text-slate-400 flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showHeatmap} 
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800"
              />
              Show Heatmap
            </label>
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
          </div>
          
          <div className="h-6 w-px bg-slate-800" />
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Load Pattern:</span>
            <button 
              onClick={() => loadDebugPattern('snake')}
              className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            >
              Snake
            </button>
            <button 
              onClick={() => loadDebugPattern('corners')}
              className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            >
              Corners
            </button>
            <button 
              onClick={() => loadDebugPattern('arp')}
              className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            >
              Arp
            </button>
            <button 
              onClick={() => loadDebugPattern('drum')}
              className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            >
              Drum
            </button>
            <button 
              onClick={handleResetPattern}
              className="px-2 py-1 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded border border-red-900/50"
            >
              Reset
            </button>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Grid Root Note:</label>
            <input 
              type="number" 
              value={activeSection?.instrumentConfig.bottomLeftNote ?? 0}
              onChange={(e) => {
                if (activeSection) {
                  handleUpdateSection(activeSection.id, 'bottomLeftNote', parseInt(e.target.value) || 0);
                }
              }}
              className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
            />
          </div>
        </div>

        {/* Grid Area */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-slate-950">
          {!activeMapping ? (
            <div className="text-center p-8 bg-slate-800 rounded-lg border border-slate-700 max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-slate-200 mb-2">No Layout Mapping Found</h2>
              <p className="text-slate-400 text-sm mb-4">
                Import a layout using the "Import Layout" button in the sidebar, or create one in the Designer.
              </p>
              {projectState.mappings.length > 0 && (
                <p className="text-yellow-400 text-xs mt-2">
                  Note: {projectState.mappings.length} mapping(s) exist but none is selected.
                </p>
              )}
            </div>
          ) : !activeLayout ? (
            <div className="text-center p-8 bg-slate-800 rounded-lg border border-slate-700 max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-slate-200 mb-2">No Performance Layout Selected</h2>
              <p className="text-slate-400 text-sm mb-4">
                You need to select or create a performance layout to analyze.
              </p>
              <p className="text-slate-500 text-xs">
                Use the sidebar to create a new layout or select an existing one.
              </p>
            </div>
          ) : (
            <GridArea
              activeLayout={activeLayout}
              currentStep={currentStep}
              activeSection={activeSection}
              gridPattern={activeGridPattern}
              onTogglePad={handleTogglePad}
              showDebugLabels={showDebugLabels}
              viewAllSteps={viewAllSteps}
              engineResult={engineResult}
              activeMapping={activeMapping}
              readOnly={false}
              highlightedCell={highlightedCell}
              onCellClick={(row, col) => {
                // Handle cell click - could be used for finger assignment UI
                const cellKey = `${row},${col}`;
                // For now, just log - we can add finger assignment UI later
                console.log('Cell clicked:', { row, col, cellKey });
              }}
              onUpdateFingerConstraint={(cellKey, constraint) => {
                if (!activeMapping) return;
                const newConstraints = { ...activeMapping.fingerConstraints };
                if (constraint === null) {
                  delete newConstraints[cellKey];
                } else {
                  newConstraints[cellKey] = constraint;
                }
                onUpdateMapping({ fingerConstraints: newConstraints });
              }}
            />
          )}
        </div>
        
        {/* Timeline Area */}
        <div className="h-48 flex-none border-t border-gray-700 overflow-x-auto bg-slate-900">
          <TimelineArea 
            steps={activeGridPattern.length}
            currentStep={currentStep}
            onStepSelect={setCurrentStep}
            sectionMaps={projectState.sectionMaps}
          />
        </div>
      </div>

      {/* Right Panel (Analysis) */}
      <div className="w-80 flex-none border-l border-gray-700 overflow-y-auto bg-gray-800">
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
  );
};

