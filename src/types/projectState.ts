import { Performance, SectionMap } from './performance';
import { SoundAsset, GridMapping } from './layout';

export interface LayoutSnapshot {
  id: string;
  name: string;
  performance: Performance;
  createdAt: string;
}

export interface ProjectState {
  layouts: LayoutSnapshot[];
  sectionMaps: SectionMap[];
  activeLayoutId: string | null;
  projectTempo: number;
  /** Staging area for sound assets before assignment to grid */
  parkedSounds: SoundAsset[];
  /** Array of grid mapping configurations */
  mappings: GridMapping[];
}
