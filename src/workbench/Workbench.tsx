import React, { useState, useMemo, useEffect } from 'react';
import { LayoutDesigner } from './LayoutDesigner';
import { AnalysisView } from './AnalysisView';
import { ProjectState } from '../types/projectState';
import { GridMapping, SoundAsset } from '../types/layout';
import { InstrumentConfig } from '../types/performance';

// Dummy Initial Data
const INITIAL_INSTRUMENT_CONFIG: InstrumentConfig = {
  id: 'inst-1',
  name: 'Standard Drum Kit',
  bottomLeftNote: 0, // C-2
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
  const [viewMode, setViewMode] = useState<'analysis' | 'design'>('design');
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
      setProjectState(prev => ({
        ...prev,
        mappings: [...prev.mappings, newMapping],
      }));
      // Set activeMappingId immediately to ensure it's available
      setActiveMappingId(newMapping.id);
    } else {
      // Update existing mapping
      setProjectState(prev => ({
        ...prev,
        mappings: prev.mappings.map(m => {
          if (m.id !== activeMapping.id) return m;
          return {
            ...m,
            cells: {
              ...m.cells,
              [cellKey]: sound,
            },
          };
        }),
      }));
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
      setProjectState(prev => ({
        ...prev,
        mappings: [...prev.mappings, newMapping],
      }));
      // Set activeMappingId immediately to ensure it's available
      setActiveMappingId(newMapping.id);
    } else {
      // Update existing mapping with all assignments
      setProjectState(prev => ({
        ...prev,
        mappings: prev.mappings.map(m => {
          if (m.id !== activeMapping.id) return m;
          return {
            ...m,
            cells: {
              ...m.cells,
              ...assignments,
            },
          };
        }),
      }));
    }
  };

  const handleUpdateMapping = (updates: Partial<GridMapping>) => {
    if (!activeMapping) return;
    
    setProjectState(prev => ({
      ...prev,
      mappings: prev.mappings.map(m => {
        if (m.id !== activeMapping.id) return m;
        return { ...m, ...updates };
      }),
    }));
  };

  const handleDuplicateMapping = () => {
    if (!activeMapping) return;
    
    const newMapping: GridMapping = {
      ...activeMapping,
      id: `mapping-${Date.now()}`,
      name: `${activeMapping.name} (Copy)`,
    };
    
    setProjectState(prev => ({
      ...prev,
      mappings: [...prev.mappings, newMapping],
    }));
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
    setProjectState(prev => ({
      ...prev,
      parkedSounds: [...prev.parkedSounds, sound],
    }));
  };

  const handleUpdateSound = (soundId: string, updates: Partial<SoundAsset>) => {
    setProjectState(prev => {
      // Update in parkedSounds
      const updatedParkedSounds = prev.parkedSounds.map(s => 
        s.id === soundId ? { ...s, ...updates } : s
      );

      // Also update in all mappings if the sound exists there
      const updatedMappings = prev.mappings.map(m => {
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

      return {
        ...prev,
        parkedSounds: updatedParkedSounds,
        mappings: updatedMappings,
      };
    });
  };

  const handleUpdateMappingSound = (cellKey: string, updates: Partial<SoundAsset>) => {
    if (!activeMapping) return;
    
    setProjectState(prev => {
      let soundIdToUpdate: string | null = null;
      let updatedCellSound: SoundAsset | null = null;

      // Update in the active mapping
      const updatedMappings = prev.mappings.map(m => {
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
        ? prev.parkedSounds.map(s => 
            s.id === soundIdToUpdate ? { ...s, ...updates } : s
          )
        : prev.parkedSounds;

      return {
        ...prev,
        parkedSounds: updatedParkedSounds,
        mappings: updatedMappings,
      };
    });
  };

  const handleRemoveSound = (cellKey: string) => {
    if (!activeMapping) return;
    
    setProjectState(prev => ({
      ...prev,
      mappings: prev.mappings.map(m => {
        if (m.id !== activeMapping.id) return m;
        const newCells = { ...m.cells };
        delete newCells[cellKey];
        return {
          ...m,
          cells: newCells,
        };
      }),
    }));
  };

  const loadProjectInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header (Top) */}
      <div className="flex-none h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        {/* Left: App Title */}
        <div className="flex items-center">
          <h1 className="text-lg font-semibold text-slate-200">Push 3 Optimizer</h1>
        </div>

        {/* Center: View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-800 rounded p-1 border border-slate-700">
          <button
            onClick={() => setViewMode('analysis')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === 'analysis'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Analysis
          </button>
          <button
            onClick={() => setViewMode('design')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === 'design'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Designer
          </button>
        </div>

        {/* Right: Save/Load Project */}
        <div className="flex items-center gap-2">
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

      {/* Main Body (Middle) */}
      {viewMode === 'design' ? (
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
            projectState={projectState}
            onUpdateProjectState={setProjectState}
            onSetActiveMappingId={setActiveMappingId}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <AnalysisView
            projectState={projectState}
            activeLayout={activeLayout}
            activeMapping={activeMapping}
            onUpdateProjectState={setProjectState}
            onUpdateMapping={handleUpdateMapping}
            onSetActiveMappingId={setActiveMappingId}
          />
        </div>
      )}
    </div>
  );
};
