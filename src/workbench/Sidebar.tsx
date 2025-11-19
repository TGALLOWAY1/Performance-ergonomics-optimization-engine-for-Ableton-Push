import React, { useRef } from 'react';
import { LayoutList } from './LayoutList';
import { SectionMapList } from './SectionMapList';
import { LayoutSnapshot } from '../types/projectState';
import { SectionMap } from '../types/performance';

interface SidebarProps {
  layouts: LayoutSnapshot[];
  activeLayoutId: string | null;
  sectionMaps: SectionMap[];
  onSelectLayout: (id: string) => void;
  onCreateLayout: () => void;
  onDeleteLayout: (id: string) => void;
  onUpdateSection: (id: string, field: 'startMeasure' | 'endMeasure' | 'bottomLeftNote', value: number) => void;
  onSaveProject: () => void;
  onLoadProject: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportMidi: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  layouts,
  activeLayoutId,
  sectionMaps,
  onSelectLayout,
  onCreateLayout,
  onDeleteLayout,
  onUpdateSection,
  onSaveProject,
  onLoadProject,
  onImportMidi,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const midiInputRef = useRef<HTMLInputElement>(null);

  return (
    <div id="sidebar" className="w-64 border-r border-border bg-slate-900 p-4 flex flex-col gap-4 overflow-y-auto">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-slate-100">Push 3 Optimizer</h2>
        <div className="flex gap-2">
          <button
            onClick={onSaveProject}
            className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded border border-slate-600"
          >
            Save Project
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded border border-slate-600"
          >
            Load Project
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={onLoadProject}
            className="hidden"
            accept=".json"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => midiInputRef.current?.click()}
            className="flex-1 px-2 py-1 text-xs bg-blue-700 hover:bg-blue-600 text-blue-100 rounded border border-blue-600"
          >
            Import MIDI
          </button>
          <input
            type="file"
            ref={midiInputRef}
            onChange={onImportMidi}
            className="hidden"
            accept=".mid,.midi"
          />
        </div>
      </div>
      
      <div className="flex-1 flex flex-col gap-6">
        <LayoutList
          layouts={layouts}
          activeLayoutId={activeLayoutId}
          onSelectLayout={onSelectLayout}
          onCreateLayout={onCreateLayout}
          onDeleteLayout={onDeleteLayout}
        />
        <div className="border-t border-slate-800" />
        <SectionMapList
          sectionMaps={sectionMaps}
          onUpdateSection={onUpdateSection}
        />
      </div>
    </div>
  );
};
