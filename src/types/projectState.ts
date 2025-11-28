import { Performance } from './performance';
import { Voice, GridMapping } from './layout';
import { InstrumentConfig } from '../types/performance';
import { FingerType } from '../engine/models';

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
}

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
});
