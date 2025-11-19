import { Performance, SectionMap } from './performance';

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
}

