import { Performance } from './performance';
import { SoundAsset, GridMapping } from './layout';
import { InstrumentConfig, SectionMap } from '../data/models';

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
  sectionMaps: SectionMap[];
  activeLayoutId: string | null;
  projectTempo: number;
  /** Staging area for sound assets before assignment to grid */
  parkedSounds: SoundAsset[];
  /** Array of grid mapping configurations */
  mappings: GridMapping[];
  /** Voice Manager: Array of note numbers (Cells) that should be ignored/hidden in analysis and grid view. Defaults to empty array. */
  ignoredNoteNumbers?: number[];
}
