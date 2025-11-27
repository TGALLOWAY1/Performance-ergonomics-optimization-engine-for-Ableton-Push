import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ProjectState } from '../types/projectState';
import { InstrumentConfig } from '../types/performance';
import { useProjectHistory } from '../hooks/useProjectHistory';
import { EngineResult } from '../engine/core';

// Initial Data
const INITIAL_INSTRUMENT_CONFIG: InstrumentConfig = {
    id: 'inst-1',
    name: 'Standard Drum Kit',
    bottomLeftNote: 36, // C2
    rows: 8,
    cols: 8,
    layoutMode: 'drum_64'
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
    sectionMaps: [], // Initialize empty
    instrumentConfig: INITIAL_INSTRUMENT_CONFIG,
    activeLayoutId: 'layout-1',
    projectTempo: 120,
    parkedSounds: [],
    mappings: [],
    ignoredNoteNumbers: []
};



interface ProjectContextType {
    projectState: ProjectState;
    setProjectState: (state: ProjectState | ((prev: ProjectState) => ProjectState), skipHistory?: boolean) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    engineResult: EngineResult | null;
    setEngineResult: (result: EngineResult | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const {
        projectState,
        setProjectState,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useProjectHistory(INITIAL_PROJECT_STATE);

    const [engineResult, setEngineResult] = useState<EngineResult | null>(null);

    return (
        <ProjectContext.Provider value={{
            projectState,
            setProjectState,
            undo,
            redo,
            canUndo,
            canRedo,
            engineResult,
            setEngineResult,
        }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};
