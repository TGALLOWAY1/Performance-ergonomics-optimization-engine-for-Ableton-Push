import { Performance, EngineConfiguration, RestingPose } from './performance';
import { Voice, GridMapping } from './layout';
import { InstrumentConfig } from '../types/performance';
import { FingerType } from '../engine/models';
import { EngineResult } from '../engine/core';

export interface LayoutSnapshot {
  id: string;
  name: string;
  performance: Performance;
  createdAt: string;
}

/**
 * A5: Updated ProjectState to include instrumentConfigs and sectionMaps arrays.
 * Central state container for the entire project.
 */
export interface ProjectState {
  layouts: LayoutSnapshot[];
  /** A5: Array of instrument configurations available in the project */
  instrumentConfigs: InstrumentConfig[];
  /** A5: Array of section maps that define time-based grid configurations */
  sectionMaps: any[]; // Using any[] temporarily to fix build, should be SectionMap[]

  instrumentConfig: InstrumentConfig;
  activeLayoutId: string | null;
  projectTempo: number;
  /** Staging area for sound assets before assignment to grid */
  parkedSounds: Voice[];
  /** Array of grid mapping configurations */
  mappings: GridMapping[];
  /** Voice Manager: Array of note numbers (Cells) that should be ignored/hidden in analysis and grid view. Defaults to empty array. */
  ignoredNoteNumbers?: number[];

  /** 
   * Manual finger assignment overrides.
   * Key 1: layoutId
   * Key 2: eventIndex (stringified number)
   * Value: { hand: 'left' | 'right', finger: FingerType }
   */
  manualAssignments?: Record<string, Record<string, { hand: 'left' | 'right', finger: FingerType }>>;

  /**
   * Beam Search engine configuration.
   * Controls the biomechanical solver parameters.
   */
  engineConfiguration?: EngineConfiguration;

  /**
   * Map of solver results by solver ID.
   * Keys are solver identifiers like 'beam', 'genetic', 'genetic_v2', etc.
   * Allows storing multiple solver results simultaneously for comparison.
   */
  solverResults?: Record<string, EngineResult>;

  /**
   * ID of the currently active solver result.
   * This determines which result is visualized on the grid.
   * Must correspond to a key in `solverResults`.
   */
  activeSolverId?: string;
}

// ============================================================================
// Hand Size Presets for Resting Poses
// ============================================================================

/**
 * Standard Hand - "Claw" shape resting pose.
 * Left hand centered at (2, 2), Right hand centered at (5, 2).
 * Suitable for most players with average hand span.
 */
export const STANDARD_HAND_RESTING_POSE: RestingPose = {
  left: {
    centroid: { x: 2, y: 2 },
    fingers: {
      thumb: { x: 0, y: 1 },
      index: { x: 1, y: 3 },
      middle: { x: 2, y: 3 },
      ring: { x: 3, y: 2 },
      pinky: { x: 4, y: 1 },
    },
  },
  right: {
    centroid: { x: 5, y: 2 },
    fingers: {
      thumb: { x: 7, y: 1 },
      index: { x: 6, y: 3 },
      middle: { x: 5, y: 3 },
      ring: { x: 4, y: 2 },
      pinky: { x: 3, y: 1 },
    },
  },
};

/**
 * Large Hand - Extended "Claw" shape resting pose.
 * Wider finger spread for players with larger hands.
 * Left hand centered at (2, 2), Right hand centered at (5, 2).
 */
export const LARGE_HAND_RESTING_POSE: RestingPose = {
  left: {
    centroid: { x: 2, y: 2 },
    fingers: {
      thumb: { x: 0, y: 0 },
      index: { x: 1, y: 4 },
      middle: { x: 2, y: 4 },
      ring: { x: 3, y: 3 },
      pinky: { x: 4, y: 2 },
    },
  },
  right: {
    centroid: { x: 5, y: 2 },
    fingers: {
      thumb: { x: 7, y: 0 },
      index: { x: 6, y: 4 },
      middle: { x: 5, y: 4 },
      ring: { x: 4, y: 3 },
      pinky: { x: 3, y: 2 },
    },
  },
};

/**
 * Small Hand - Compact "Claw" shape resting pose.
 * Tighter finger spread for players with smaller hands.
 * Left hand centered at (2, 2), Right hand centered at (5, 2).
 */
export const SMALL_HAND_RESTING_POSE: RestingPose = {
  left: {
    centroid: { x: 2, y: 2 },
    fingers: {
      thumb: { x: 1, y: 1 },
      index: { x: 2, y: 3 },
      middle: { x: 2, y: 3 },
      ring: { x: 3, y: 2 },
      pinky: { x: 3, y: 1 },
    },
  },
  right: {
    centroid: { x: 5, y: 2 },
    fingers: {
      thumb: { x: 6, y: 1 },
      index: { x: 5, y: 3 },
      middle: { x: 5, y: 3 },
      ring: { x: 4, y: 2 },
      pinky: { x: 4, y: 1 },
    },
  },
};

/**
 * Hand size preset type for UI selection.
 */
export type HandSizePreset = 'small' | 'standard' | 'large';

/**
 * Map of hand size presets to their resting poses.
 */
export const HAND_SIZE_PRESETS: Record<HandSizePreset, RestingPose> = {
  small: SMALL_HAND_RESTING_POSE,
  standard: STANDARD_HAND_RESTING_POSE,
  large: LARGE_HAND_RESTING_POSE,
};

/**
 * Default resting pose - uses the Standard Hand "Claw" shape.
 * @deprecated Use STANDARD_HAND_RESTING_POSE instead
 */
export const DEFAULT_RESTING_POSE: RestingPose = STANDARD_HAND_RESTING_POSE;

/**
 * Default engine configuration for the Beam Search solver.
 * 
 * - beamWidth: 50 (balance between accuracy and performance)
 * - stiffness: 1.0 (strong attractor force to home position)
 * - restingPose: Standard Hand "Claw" shape
 */
export const DEFAULT_ENGINE_CONFIGURATION: EngineConfiguration = {
  beamWidth: 50,
  stiffness: 1.0,
  restingPose: STANDARD_HAND_RESTING_POSE,
};

export const createInitialProjectState = (): ProjectState => ({
  layouts: [],
  instrumentConfigs: [],
  sectionMaps: [],
  instrumentConfig: {
    id: 'default-config',
    name: 'Default 64-Pad Layout',
    rows: 8,
    cols: 8,
    bottomLeftNote: 36,
    layoutMode: 'drum_64',
  },
  activeLayoutId: null,
  projectTempo: 120,
  parkedSounds: [],
  mappings: [],
  ignoredNoteNumbers: [],
  manualAssignments: {},
  engineConfiguration: DEFAULT_ENGINE_CONFIGURATION,
  solverResults: {},
  activeSolverId: undefined,
});
