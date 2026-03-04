/**
 * Project persistence utilities for saving and loading project state.
 */

import { ProjectState } from '../types/projectState';

/**
 * Saves the full project state to a JSON file.
 * 
 * @param state - The complete ProjectState to save
 */
export function saveProject(state: ProjectState): void {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'project.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validates and sanitizes a parsed JSON object into a safe ProjectState.
 * Prevents undefined-reference crashes by supplying robust fallback values.
 */
export function validateProjectState(parsed: any): ProjectState {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid project state data structure.');
  }

  return {
    layouts: Array.isArray(parsed.layouts) ? parsed.layouts : [],
    sectionMaps: Array.isArray(parsed.sectionMaps) ? parsed.sectionMaps : [],
    activeLayoutId: parsed.activeLayoutId || null,
    activeMappingId: parsed.activeMappingId || null,
    projectTempo: parsed.projectTempo || 120,
    parkedSounds: Array.isArray(parsed.parkedSounds) ? parsed.parkedSounds : [],
    mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
    instrumentConfigs: Array.isArray(parsed.instrumentConfigs) ? parsed.instrumentConfigs : [],
    instrumentConfig: parsed.instrumentConfig || (Array.isArray(parsed.instrumentConfigs) ? parsed.instrumentConfigs[0] : null) || null,
    ignoredNoteNumbers: Array.isArray(parsed.ignoredNoteNumbers) ? parsed.ignoredNoteNumbers : [],
    manualAssignments: parsed.manualAssignments || {},
    engineConfiguration: parsed.engineConfiguration || { beamWidth: 50, stiffness: 1.0, restingPose: 'standard' },
    solverResults: parsed.solverResults || {},
    activeSolverId: parsed.activeSolverId || undefined,
  };
}

/**
 * Loads a project state from a JSON file.
 * 
 * @param file - The JSON file to load
 * @returns Promise that resolves to the loaded ProjectState
 */
export async function loadProject(file: File): Promise<ProjectState> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  return validateProjectState(parsed);
}

/**
 * Saves a project state to localStorage using a specific ID.
 * 
 * @param id - The unique ID for this project/song
 * @param state - The ProjectState to save
 */
export function saveProjectStateToStorage(id: string, state: ProjectState): void {
  try {
    const key = `push_perf_project_${id}`;
    const json = JSON.stringify(state);
    localStorage.setItem(key, json);
    console.log('[projectPersistence] Saved state to localStorage:', {
      key,
      parkedSoundsCount: state.parkedSounds.length,
      voiceNames: state.parkedSounds.map(v => v.name),
      mappingsCount: state.mappings.length,
      mappingCells: state.mappings.map(m => Object.keys(m.cells).length),
    });
  } catch (err) {
    console.error('Failed to save project state to storage:', err);
    // Handle quota exceeded or other errors
  }
}
/**
 * Loads the project state from local storage.
 * 
 * @param id - The unique ID for this project state
 * @returns The loaded ProjectState or null if not found
 */
export function loadProjectStateFromStorage(id: string): ProjectState | null {
  try {
    const key = `push_perf_project_${id}`;
    const json = localStorage.getItem(key);
    if (!json) {
      console.log('[projectPersistence] No state found in localStorage for key:', key);
      return null;
    }

    const parsed = JSON.parse(json);
    const validatedState = validateProjectState(parsed);

    console.log('[projectPersistence] Loaded state from localStorage:', {
      key,
      parkedSoundsCount: validatedState.parkedSounds.length,
      voiceNames: validatedState.parkedSounds.map(v => v.name),
      mappingsCount: validatedState.mappings.length,
      mappingCells: validatedState.mappings.map(m => Object.keys(m.cells).length),
    });
    return validatedState;
  } catch (err) {
    console.error('Failed to load project state from storage:', err);
    return null;
  }
}

/**
 * Deletes the project state from local storage.
 * 
 * @param id - The unique ID for this project state
 */
export function deleteProjectStateFromStorage(id: string): void {
  try {
    const key = `push_perf_project_${id}`;
    localStorage.removeItem(key);
  } catch (err) {
    console.error('Failed to delete project state from storage:', err);
  }
}
