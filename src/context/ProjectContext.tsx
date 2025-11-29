import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { ProjectState, DEFAULT_ENGINE_CONFIGURATION } from '../types/projectState';
import { InstrumentConfig } from '../types/performance';
import { useProjectHistory } from '../hooks/useProjectHistory';
import { EngineResult, BiomechanicalSolver, SolverType } from '../engine/core';
import { FingerType } from '../engine/models';
import { getActivePerformance } from '../utils/performanceSelectors';
import { GridMapping, LayoutMode } from '../types/layout';
import { createAnnealingSolver } from '../engine/solvers/AnnealingSolver';

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
    ignoredNoteNumbers: [],
    manualAssignments: {},
    // Engine configuration with defaults:
    // - beamWidth: 50 (balance between accuracy and performance)
    // - stiffness: 1.0 (strong attractor force to home position)
    // - restingPose: Standard Hand "Claw" shape at (2,2) left, (5,2) right
    engineConfiguration: DEFAULT_ENGINE_CONFIGURATION,
    solverResults: {},
    activeSolverId: undefined,
};



interface ProjectContextType {
    projectState: ProjectState;
    setProjectState: (state: ProjectState | ((prev: ProjectState) => ProjectState), skipHistory?: boolean) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    /** 
     * Currently active engine result (derived from solverResults[activeSolverId]).
     * This is the result that should be visualized on the grid.
     */
    engineResult: EngineResult | null;
    /** 
     * @deprecated Use runSolver() instead. This is kept for backwards compatibility.
     * Directly sets the engine result, but doesn't store it in the results map.
     */
    setEngineResult: (result: EngineResult | null) => void;
    /**
     * Runs a solver and stores the result in the solverResults map.
     * The result is stored under the solverType key (e.g., 'beam', 'genetic').
     * Does NOT overwrite results from different solvers.
     * 
     * @param solverType - The solver algorithm to run ('beam' | 'genetic')
     * @param activeMapping - Optional grid mapping to use (defaults to first mapping)
     * @returns Promise that resolves when the solver completes
     */
    runSolver: (solverType: SolverType, activeMapping?: GridMapping | null) => Promise<void>;
    /**
     * Sets the active solver ID, which determines which result is visualized.
     * 
     * @param solverId - The solver ID (must exist in solverResults)
     */
    setActiveSolverId: (solverId: string) => void;
    /**
     * Gets a specific solver result by ID.
     * 
     * @param solverId - The solver ID
     * @returns The engine result, or null if not found
     */
    getSolverResult: (solverId: string) => EngineResult | null;
    /**
     * Optimizes the layout using Simulated Annealing.
     * This will rearrange pad assignments to minimize ergonomic cost.
     * 
     * @param activeMapping - The mapping to optimize (defaults to first mapping)
     * @returns Promise that resolves when optimization completes
     */
    optimizeLayout: (activeMapping?: GridMapping | null) => Promise<void>;
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

    // Legacy state for backwards compatibility
    const [legacyEngineResult, setLegacyEngineResult] = useState<EngineResult | null>(null);

    // Derive active result from solverResults map
    const activeResult = useMemo(() => {
        const { solverResults, activeSolverId } = projectState;
        
        // If activeSolverId is set and exists in results, use it
        if (activeSolverId && solverResults && solverResults[activeSolverId]) {
            return solverResults[activeSolverId];
        }
        
        // Fallback to legacy state for backwards compatibility
        return legacyEngineResult;
    }, [projectState.solverResults, projectState.activeSolverId, legacyEngineResult]);

    /**
     * Runs a solver and stores the result in the solverResults map.
     */
    const runSolver = async (solverType: SolverType, activeMapping?: GridMapping | null): Promise<void> => {
        // Get filtered performance
        const filteredPerformance = getActivePerformance(projectState);
        if (!filteredPerformance) {
            console.warn('[ProjectContext] Cannot run solver: no active performance');
            return;
        }

        // Get active mapping (use provided or find first)
        const mapping = activeMapping ?? 
            (projectState.mappings.length > 0 ? projectState.mappings[0] : null);

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

        try {
            // Create solver with the specified type
            const solver = new BiomechanicalSolver(
                projectState.instrumentConfig,
                mapping,
                undefined, // Use default engine constants
                projectState.engineConfiguration || DEFAULT_ENGINE_CONFIGURATION,
                solverType
            );

            // Run solver (async for genetic, sync for beam)
            let result: EngineResult;
            if (solverType === 'genetic') {
                // Genetic solver is always async
                result = await solver.solveAsync(filteredPerformance, parsedAssignments);
            } else {
                // Beam solver supports sync
                try {
                    result = solver.solve(filteredPerformance, parsedAssignments);
                } catch (error) {
                    // Fallback to async if sync fails
                    result = await solver.solveAsync(filteredPerformance, parsedAssignments);
                }
            }

            // Store result in solverResults map
            setProjectState(prev => ({
                ...prev,
                solverResults: {
                    ...(prev.solverResults || {}),
                    [solverType]: result,
                },
                // Auto-set as active if no active solver is set
                activeSolverId: prev.activeSolverId || solverType,
            }));

            console.log(`[ProjectContext] Solver '${solverType}' completed:`, {
                score: result.score,
                hardCount: result.hardCount,
                unplayableCount: result.unplayableCount,
            });
        } catch (error) {
            console.error(`[ProjectContext] Solver '${solverType}' failed:`, error);
            throw error;
        }
    };

    /**
     * Sets the active solver ID.
     */
    const setActiveSolverId = (solverId: string): void => {
        setProjectState(prev => {
            // Validate that the solver ID exists in results
            if (prev.solverResults && prev.solverResults[solverId]) {
                return {
                    ...prev,
                    activeSolverId: solverId,
                };
            }
            console.warn(`[ProjectContext] Cannot set active solver: '${solverId}' not found in results`);
            return prev;
        });
    };

    /**
     * Gets a specific solver result by ID.
     */
    const getSolverResult = (solverId: string): EngineResult | null => {
        return projectState.solverResults?.[solverId] || null;
    };

    /**
     * Optimizes the layout using Simulated Annealing.
     */
    const optimizeLayout = async (activeMapping?: GridMapping | null): Promise<void> => {
        // Get filtered performance
        const filteredPerformance = getActivePerformance(projectState);
        if (!filteredPerformance) {
            console.warn('[ProjectContext] Cannot optimize layout: no active performance');
            throw new Error('No performance data available. Please load a MIDI file first.');
        }

        // Get active mapping (use provided or find first)
        const mapping = activeMapping ?? 
            (projectState.mappings.length > 0 ? projectState.mappings[0] : null);

        if (!mapping) {
            throw new Error('No mapping to optimize. Please assign some sounds to the grid first.');
        }

        if (Object.keys(mapping.cells).length === 0) {
            throw new Error('No sounds assigned to the grid. Please assign sounds first, then optimize.');
        }

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

        try {
            // Create AnnealingSolver
            const solver = createAnnealingSolver({
                instrumentConfig: projectState.instrumentConfig,
                gridMapping: mapping,
            });

            // Run the solver
            const result = await solver.solve(
                filteredPerformance,
                projectState.engineConfiguration || DEFAULT_ENGINE_CONFIGURATION,
                parsedAssignments
            );

            // Get the optimized mapping
            const optimizedMapping = solver.getBestMapping();
            if (!optimizedMapping) {
                throw new Error('Optimization failed: no mapping was generated');
            }

            // Update the mapping in project state (wrapped in history for undo/redo)
            setProjectState(prev => ({
                ...prev,
                mappings: prev.mappings.map(m =>
                    m.id === mapping.id
                        ? {
                            ...optimizedMapping,
                            id: m.id, // Preserve the mapping ID
                            name: m.name, // Preserve the mapping name
                            notes: m.notes, // Preserve notes
                            layoutMode: 'optimized' as LayoutMode,
                            scoreCache: result.score,
                            version: (m.version || 0) + 1, // Increment version
                            savedAt: new Date().toISOString(),
                        }
                        : m
                ),
                // Store the result
                solverResults: {
                    ...(prev.solverResults || {}),
                    'annealing': result,
                },
                // Auto-set as active if no active solver is set
                activeSolverId: prev.activeSolverId || 'annealing',
            }));

            console.log('[ProjectContext] Layout optimization complete:', {
                score: result.score,
                hardCount: result.hardCount,
                unplayableCount: result.unplayableCount,
            });
        } catch (error) {
            console.error('[ProjectContext] Layout optimization failed:', error);
            throw error;
        }
    };

    /**
     * Legacy setEngineResult for backwards compatibility.
     * This directly sets the legacy state but doesn't update the results map.
     */
    const setEngineResult = (result: EngineResult | null): void => {
        setLegacyEngineResult(result);
    };

    return (
        <ProjectContext.Provider value={{
            projectState,
            setProjectState,
            undo,
            redo,
            canUndo,
            canRedo,
            engineResult: activeResult,
            setEngineResult,
            runSolver,
            setActiveSolverId,
            getSolverResult,
            optimizeLayout,
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
