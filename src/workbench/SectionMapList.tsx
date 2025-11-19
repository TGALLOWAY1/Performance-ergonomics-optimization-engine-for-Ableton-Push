import React from 'react';
import { SectionMap } from '../types/performance';

interface SectionMapListProps {
  sectionMaps: SectionMap[];
  onUpdateSection: (id: string, field: 'startMeasure' | 'endMeasure' | 'bottomLeftNote', value: number) => void;
}

export const SectionMapList: React.FC<SectionMapListProps> = ({
  sectionMaps,
  onUpdateSection,
}) => {
  return (
    <div className="flex flex-col gap-2 mt-4">
      <h3 className="text-sm font-semibold text-slate-300">Section Maps</h3>
      <div className="flex flex-col gap-2">
        {sectionMaps.map((section) => (
          <div
            key={section.id}
            className="flex flex-col gap-2 p-3 bg-slate-800 rounded border border-slate-700 text-sm"
          >
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>{section.instrumentConfig.name}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col">
                <label className="text-xs text-slate-500 mb-1">Start Bar</label>
                <input
                  type="number"
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
                  value={section.startMeasure}
                  onChange={(e) => onUpdateSection(section.id, 'startMeasure', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-slate-500 mb-1">End Bar</label>
                <input
                  type="number"
                  className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
                  value={section.endMeasure}
                  onChange={(e) => onUpdateSection(section.id, 'endMeasure', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-1">Bottom Left Note (MIDI)</label>
              <input
                type="number"
                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs focus:border-blue-500 outline-none"
                value={section.instrumentConfig.bottomLeftNote}
                onChange={(e) => onUpdateSection(section.id, 'bottomLeftNote', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        ))}
        {sectionMaps.length === 0 && (
          <div className="text-xs text-slate-500 italic p-2">No sections defined.</div>
        )}
      </div>
    </div>
  );
};

