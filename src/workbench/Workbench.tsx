import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { GridArea } from './GridArea';
import { TimelineArea } from './TimelineArea';
import { EngineResultsPanel } from './EngineResultsPanel';
import { ProjectState, LayoutSnapshot } from '../types/projectState';
import { InstrumentConfig } from '../types/performance';
import { GridPattern } from '../types/gridPattern';
import { createEmptyPattern, toggleStepPad } from '../utils/gridPatternUtils';
import { gridPatternToPerformance } from '../utils/gridPatternToPerformance';
import { parseMidiFile } from '../utils/midiImport';
import { GridMapService } from '../engine/gridMapService';
import { getSnakePattern, getCornersPattern, getRangeTestPattern, getKillaArp, getDrumBeat } from '../utils/debugPatterns';
import { runEngine, EngineResult } from '../engine/runEngine';

// Dummy Initial Data
const INITIAL_INSTRUMENT_CONFIG: InstrumentConfig = {
  id: 'inst-1',
  name: 'Standard Drum Kit',
  bottomLeftNote: 36, // C1
  layoutMode: 'drum_64',
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
  sectionMaps: [
    {
      id: 'section-1',
      startMeasure: 1,
      endMeasure: 4,
      instrumentConfig: INITIAL_INSTRUMENT_CONFIG
    }
  ],
  activeLayoutId: 'layout-1',
  projectTempo: 120,
  parkedSounds: [],
  mappings: []
};

export const Workbench: React.FC = () => {
  const [projectState, setProjectState] = useState<ProjectState>(INITIAL_PROJECT_STATE);
  
  // Local state for the grid pattern (step sequencer)
  // In a real app, this might be part of the layout or derived from performance
  // For now, we keep it simple and tied to the active layout in memory
  const [gridPatterns, setGridPatterns] = useState<Record<string, GridPattern>>({
    'layout-1': createEmptyPattern(64) // Increased to 64 steps (4 measures)
  });
  
  const [currentStep, setCurrentStep] = useState(0);
  const [showDebugLabels, setShowDebugLabels] = useState(false);
  const [viewAllSteps, setViewAllSteps] = useState(false);
  const [engineResult, setEngineResult] = useState<EngineResult | null>(null);

  const activeLayout = useMemo(() => 
    projectState.layouts.find(l => l.id === projectState.activeLayoutId) || null,
    [projectState.layouts, projectState.activeLayoutId]
  );

  const activeSection = useMemo(() => 
    projectState.sectionMaps[0] || null, // Simplified: just take first section for now
    [projectState.sectionMaps]
  );

  const activeGridPattern = useMemo(() => 
    (projectState.activeLayoutId && gridPatterns[projectState.activeLayoutId]) || createEmptyPattern(64),
    [gridPatterns, projectState.activeLayoutId]
  );

  // Engine Integration Effect
  useEffect(() => {
    if (!activeLayout) return;

    const timer = setTimeout(() => {
      const result = runEngine(activeLayout.performance, projectState.sectionMaps);
      setEngineResult(result);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [activeLayout, projectState.sectionMaps]);

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

    setProjectState(prev => ({
      ...prev,
      layouts: [...prev.layouts, newLayout],
      activeLayoutId: newId
    }));
  };

  const handleDeleteLayout = (id: string) => {
    setProjectState(prev => {
      const newLayouts = prev.layouts.filter(l => l.id !== id);
      let newActiveId = prev.activeLayoutId;
      if (prev.activeLayoutId === id) {
        newActiveId = newLayouts.length > 0 ? newLayouts[0].id : null;
      }
      return {
        ...prev,
        layouts: newLayouts,
        activeLayoutId: newActiveId
      };
    });
    
    setGridPatterns(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSelectLayout = (id: string) => {
    setProjectState(prev => ({ ...prev, activeLayoutId: id }));
  };

  const handleUpdateSection = (id: string, field: 'startMeasure' | 'endMeasure' | 'bottomLeftNote', value: number) => {
    setProjectState(prev => ({
      ...prev,
      sectionMaps: prev.sectionMaps.map(section => {
        if (section.id !== id) return section;
        
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
      })
    }));
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
           setProjectState(loadedState);
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
      const performance = await parseMidiFile(file, activeSection.instrumentConfig);
      
      // Create a new layout for the imported MIDI
      const newId = `layout-${Date.now()}`;
      const newLayout: LayoutSnapshot = {
        id: newId,
        name: performance.name || 'Imported MIDI',
        createdAt: new Date().toISOString(),
        performance: performance
      };

      // Convert Performance back to GridPattern for the editor
      // This is a reverse operation of gridPatternToPerformance
      // For now, we'll create a basic pattern based on quantized events
      const newPattern = createEmptyPattern(64); // Default length
      const stepDuration = (60 / performance.tempo!) / 4; // 16th note duration

      performance.events.forEach(event => {
        const stepIndex = Math.round(event.startTime / stepDuration);
        if (stepIndex >= 0 && stepIndex < newPattern.length) {
          const pos = GridMapService.getPositionForNote(event.noteNumber, activeSection.instrumentConfig);
          if (pos) {
            // We need to use toggleStepPad logic but force it to true
            // Since toggleStepPad toggles, we check if it's false first
            if (!newPattern.steps[stepIndex][pos.row][pos.col]) {
               // Manually set it to true to avoid toggle logic complexity here
               newPattern.steps[stepIndex][pos.row][pos.col] = true;
            }
          }
        }
      });

      setGridPatterns(prev => ({
        ...prev,
        [newId]: newPattern
      }));

      setProjectState(prev => ({
        ...prev,
        layouts: [...prev.layouts, newLayout],
        activeLayoutId: newId,
        projectTempo: performance.tempo || prev.projectTempo
      }));

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

    // Convert to Performance and Update Project State
    const newPerformance = gridPatternToPerformance(
      newPattern,
      activeSection.instrumentConfig,
      projectState.projectTempo
    );

    setProjectState(prev => ({
      ...prev,
      layouts: prev.layouts.map(l => {
        if (l.id !== prev.activeLayoutId) return l;
        return {
          ...l,
          performance: newPerformance
        };
      })
    }));
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
        const pos = GridMapService.getPositionForNote(event.noteNumber, activeSection.instrumentConfig);
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

    setProjectState(prev => ({
      ...prev,
      layouts: prev.layouts.map(l => {
        if (l.id !== prev.activeLayoutId) return l;
        return {
          ...l,
          performance: performance
        };
      })
    }));
  };

  const handleResetPattern = () => {
    if (!projectState.activeLayoutId) return;
    
    setGridPatterns(prev => ({
      ...prev,
      [projectState.activeLayoutId!]: createEmptyPattern(64)
    }));

    setProjectState(prev => ({
      ...prev,
      layouts: prev.layouts.map(l => {
        if (l.id !== prev.activeLayoutId) return l;
        return {
          ...l,
          performance: {
            events: [],
            tempo: prev.projectTempo,
            name: l.performance.name
          }
        };
      })
    }));
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header (Top) */}
      <div className="flex-none h-12 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-4">
        <div className="flex items-center gap-4">
          <label className="text-xs text-slate-400 flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showDebugLabels} 
              onChange={(e) => setShowDebugLabels(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800"
            />
            Show Debug Labels
          </label>
          <label className="text-xs text-slate-400 flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={viewAllSteps} 
              onChange={(e) => setViewAllSteps(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800"
            />
            View All Steps (Flatten Time)
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
            value={activeSection?.instrumentConfig.bottomLeftNote || 36}
            onChange={(e) => {
              if (activeSection) {
                handleUpdateSection(activeSection.id, 'bottomLeftNote', parseInt(e.target.value) || 0);
              }
            }}
            className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
          />
        </div>
      </div>

      {/* Main Body (Middle) */}
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
          />
        </div>

        {/* Center Panel (Stage) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Grid Area */}
          <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-slate-950">
            <GridArea 
              activeLayout={activeLayout}
              currentStep={currentStep}
              activeSection={activeSection}
              gridPattern={activeGridPattern}
              onTogglePad={handleTogglePad}
              showDebugLabels={showDebugLabels}
              viewAllSteps={viewAllSteps}
              engineResult={engineResult}
            />
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
          <EngineResultsPanel result={engineResult} />
        </div>
      </div>
    </div>
  );
};
