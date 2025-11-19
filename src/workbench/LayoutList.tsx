import React from 'react';
import { LayoutSnapshot } from '../types/projectState';

interface LayoutListProps {
  layouts: LayoutSnapshot[];
  activeLayoutId: string | null;
  onSelectLayout: (id: string) => void;
  onCreateLayout: () => void;
  onDeleteLayout: (id: string) => void;
}

export const LayoutList: React.FC<LayoutListProps> = ({
  layouts,
  activeLayoutId,
  onSelectLayout,
  onCreateLayout,
  onDeleteLayout,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Layouts</h3>
        <button
          onClick={onCreateLayout}
          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
        >
          + New
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {layouts.map((layout) => (
          <div
            key={layout.id}
            className={`flex items-center justify-between p-2 rounded cursor-pointer text-sm ${
              layout.id === activeLayoutId
                ? 'bg-blue-900/50 border border-blue-700 text-blue-100'
                : 'bg-slate-800 border border-transparent text-slate-400 hover:bg-slate-700'
            }`}
            onClick={() => onSelectLayout(layout.id)}
          >
            <span className="truncate">{layout.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteLayout(layout.id);
              }}
              className="ml-2 text-slate-500 hover:text-red-400"
              title="Delete Layout"
            >
              ×
            </button>
          </div>
        ))}
        {layouts.length === 0 && (
          <div className="text-xs text-slate-500 italic p-2">No layouts created.</div>
        )}
      </div>
    </div>
  );
};

