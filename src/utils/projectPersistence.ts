/**
 * Project persistence utilities for saving and loading project state.
 */
import { ProjectState, DEFAULT_ENGINE_CONFIGURATION, HAND_SIZE_PRESETS, HandSizePreset } from '../types/projectState';
import {
  NaturalHandPose,
  createDefaultPose0,
  validateNaturalHandPose,
} from '../types/naturalHandPose';

/** Structured result for strict project file validation. Invalid core shape fails fast. */
export type ValidationResult =
  | { ok: true; state: ProjectState }
  | { ok: false; error: { code: string; message: string; path?: string } };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isValidManualAssignmentsShape(val: unknown): boolean {
  if (val == null || typeof val !== 'object') return false;
  for (const v of Object.values(val)) {
    if (v == null || typeof v !== 'object') return false;
    for (const entry of Object.values(v)) {
      if (!entry || typeof entry !== 'object') return false;
      const e = entry as { hand?: string; finger?: string };
      if (e.hand !== 'left' && e.hand !== 'right') return false;
      if (typeof e.finger !== 'string') return false;
    }
  }
  return true;
}

/**
 * Strict validation for project file load. Rejects malformed core shape; applies defaults only for non-critical fields.
 */
export function validateProjectStrict(parsed: unknown): ValidationResult {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: { code: 'INVALID_ROOT', message: 'Invalid project file: root must be an object.', path: undefined } };
  }
  const p = parsed as Record<string, unknown>;

  if (p.instrumentConfig == null || typeof p.instrumentConfig !== 'object') {
    return {
      ok: false,
      error: {
        code: 'MISSING_INSTRUMENT_CONFIG',
        message: 'Project file is missing or has invalid instrumentConfig. Re-export from the app or use a compatible file.',
        path: 'instrumentConfig',
      },
    };
  }

  if (!Array.isArray(p.layouts)) {
    return { ok: false, error: { code: 'INVALID_LAYOUTS', message: 'Project file must have a valid layouts array.', path: 'layouts' } };
  }
  for (let i = 0; i < p.layouts.length; i++) {
    const layout = p.layouts[i];
    if (!layout || typeof layout !== 'object' || !isNonEmptyString((layout as { id?: unknown }).id)) {
      return { ok: false, error: { code: 'INVALID_LAYOUT_ITEM', message: `Layout at index ${i} must have a non-empty id.`, path: `layouts[${i}]` } };
    }
  }

  if (!Array.isArray(p.mappings)) {
    return { ok: false, error: { code: 'INVALID_MAPPINGS', message: 'Project file must have a valid mappings array.', path: 'mappings' } };
  }
  for (let i = 0; i < p.mappings.length; i++) {
    const mapping = p.mappings[i];
    if (!mapping || typeof mapping !== 'object' || !isNonEmptyString((mapping as { id?: unknown }).id)) {
      return { ok: false, error: { code: 'INVALID_MAPPING_ITEM', message: `Mapping at index ${i} must have a non-empty id.`, path: `mappings[${i}]` } };
    }
  }

  if (p.manualAssignments !== undefined && !isValidManualAssignmentsShape(p.manualAssignments)) {
    return { ok: false, error: { code: 'INVALID_MANUAL_ASSIGNMENTS', message: 'manualAssignments must be a nested map of layoutId -> eventKey -> { hand, finger }.', path: 'manualAssignments' } };
  }

  // Validate naturalHandPoses (strict: fail on malformed, default if missing)
  let naturalHandPoses: NaturalHandPose[];
  if (p.naturalHandPoses === undefined || p.naturalHandPoses === null) {
    // Missing is OK for strict (additive field) - create default
    naturalHandPoses = [createDefaultPose0()];
  } else if (!Array.isArray(p.naturalHandPoses)) {
    return { ok: false, error: { code: 'INVALID_NATURAL_HAND_POSES', message: 'naturalHandPoses must be an array.', path: 'naturalHandPoses' } };
  } else {
    // Validate each pose strictly
    naturalHandPoses = [];
    for (let i = 0; i < p.naturalHandPoses.length; i++) {
      const pose = p.naturalHandPoses[i] as NaturalHandPose;
      const validation = validateNaturalHandPose(pose);
      if (!validation.valid) {
        return {
          ok: false,
          error: {
            code: 'INVALID_POSE',
            message: `naturalHandPoses[${i}]: ${validation.error}`,
            path: `naturalHandPoses[${i}]`,
          },
        };
      }
      naturalHandPoses.push(pose);
    }
    // Ensure Pose 0 exists
    if (naturalHandPoses.length === 0) {
      naturalHandPoses = [createDefaultPose0()];
    }
  }

  // Apply defaults/migrations for non-critical fields
  let engineConfig = (p.engineConfiguration && typeof p.engineConfiguration === 'object')
    ? p.engineConfiguration as Record<string, unknown>
    : DEFAULT_ENGINE_CONFIGURATION as unknown as Record<string, unknown>;
  if (typeof engineConfig.restingPose === 'string') {
    const preset = HAND_SIZE_PRESETS[engineConfig.restingPose as HandSizePreset] || HAND_SIZE_PRESETS.standard;
    engineConfig = { ...engineConfig, restingPose: preset };
  }

  const state: ProjectState = {
    layouts: Array.isArray(p.layouts) ? p.layouts as ProjectState['layouts'] : [],
    sectionMaps: Array.isArray(p.sectionMaps) ? p.sectionMaps : [],
    activeLayoutId: (p.activeLayoutId != null && isNonEmptyString(p.activeLayoutId)) ? p.activeLayoutId : null,
    activeMappingId: (p.activeMappingId != null && isNonEmptyString(p.activeMappingId)) ? p.activeMappingId : null,
    projectTempo: typeof p.projectTempo === 'number' && p.projectTempo > 0 ? p.projectTempo : 120,
    parkedSounds: Array.isArray(p.parkedSounds) ? p.parkedSounds as ProjectState['parkedSounds'] : [],
    mappings: Array.isArray(p.mappings) ? p.mappings as ProjectState['mappings'] : [],
    instrumentConfigs: Array.isArray(p.instrumentConfigs) ? p.instrumentConfigs as ProjectState['instrumentConfigs'] : [],
    instrumentConfig: p.instrumentConfig as ProjectState['instrumentConfig'],
    ignoredNoteNumbers: Array.isArray(p.ignoredNoteNumbers) ? p.ignoredNoteNumbers : [],
    manualAssignments: (p.manualAssignments && typeof p.manualAssignments === 'object') ? p.manualAssignments as ProjectState['manualAssignments'] : {},
    engineConfiguration: engineConfig as ProjectState['engineConfiguration'],
    solverResults: (p.solverResults && typeof p.solverResults === 'object') ? p.solverResults : {},
    activeSolverId: p.activeSolverId !== undefined ? (p.activeSolverId as string) : undefined,
    naturalHandPoses,
  };
  return { ok: true, state };
}

/**
 * Validates and sanitizes a parsed JSON object into a safe ProjectState.
 * Used for localStorage / in-memory load. For file load use validateProjectStrict + loadProject.
 */
export function validateProjectState(parsed: unknown): ProjectState {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid project state data structure.');
  }
  const p = parsed as Record<string, unknown>;

  let engineConfig = (p.engineConfiguration && typeof p.engineConfiguration === 'object')
    ? p.engineConfiguration as Record<string, unknown>
    : DEFAULT_ENGINE_CONFIGURATION as unknown as Record<string, unknown>;
  if (typeof engineConfig.restingPose === 'string') {
    const preset = HAND_SIZE_PRESETS[engineConfig.restingPose as HandSizePreset] || HAND_SIZE_PRESETS.standard;
    engineConfig = { ...engineConfig, restingPose: preset };
  }

  const instrumentConfig = p.instrumentConfig != null && typeof p.instrumentConfig === 'object'
    ? p.instrumentConfig
    : (Array.isArray(p.instrumentConfigs) && p.instrumentConfigs[0] != null) ? p.instrumentConfigs[0] : null;

  // Lenient handling for naturalHandPoses: default if missing/invalid
  let naturalHandPoses: NaturalHandPose[] = [createDefaultPose0()];
  if (Array.isArray(p.naturalHandPoses) && p.naturalHandPoses.length > 0) {
    // Try to use existing poses, filter out invalid ones
    const validPoses: NaturalHandPose[] = [];
    for (const pose of p.naturalHandPoses) {
      if (pose && typeof pose === 'object') {
        const validation = validateNaturalHandPose(pose as NaturalHandPose);
        if (validation.valid) {
          validPoses.push(pose as NaturalHandPose);
        }
      }
    }
    if (validPoses.length > 0) {
      naturalHandPoses = validPoses;
    }
  }

  return {
    layouts: Array.isArray(p.layouts) ? p.layouts as ProjectState['layouts'] : [],
    sectionMaps: Array.isArray(p.sectionMaps) ? p.sectionMaps : [],
    activeLayoutId: p.activeLayoutId != null ? p.activeLayoutId : null,
    activeMappingId: p.activeMappingId != null ? p.activeMappingId : null,
    projectTempo: typeof p.projectTempo === 'number' ? p.projectTempo : 120,
    parkedSounds: Array.isArray(p.parkedSounds) ? p.parkedSounds as ProjectState['parkedSounds'] : [],
    mappings: Array.isArray(p.mappings) ? p.mappings as ProjectState['mappings'] : [],
    instrumentConfigs: Array.isArray(p.instrumentConfigs) ? p.instrumentConfigs as ProjectState['instrumentConfigs'] : [],
    instrumentConfig: instrumentConfig as ProjectState['instrumentConfig'],
    ignoredNoteNumbers: Array.isArray(p.ignoredNoteNumbers) ? p.ignoredNoteNumbers : [],
    manualAssignments: (p.manualAssignments && typeof p.manualAssignments === 'object') ? p.manualAssignments as ProjectState['manualAssignments'] : {},
    engineConfiguration: engineConfig as ProjectState['engineConfiguration'],
    solverResults: (p.solverResults && typeof p.solverResults === 'object') ? p.solverResults : {},
    activeSolverId: p.activeSolverId !== undefined ? p.activeSolverId : undefined,
    naturalHandPoses,
  };
}

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
 * Loads a project state from a JSON file with strict validation.
 * Rejects invalid core shape; returns structured error for UI (no alert).
 *
 * @param file - The JSON file to load
 * @returns Promise resolving to ValidationResult (ok + state, or ok: false + error)
 */
export async function loadProject(file: File): Promise<ValidationResult> {
  let parsed: unknown;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid JSON';
    return { ok: false, error: { code: 'PARSE_ERROR', message: `Project file could not be parsed: ${message}. Use a valid JSON file or re-export from the app.` } };
  }
  return validateProjectStrict(parsed);
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
