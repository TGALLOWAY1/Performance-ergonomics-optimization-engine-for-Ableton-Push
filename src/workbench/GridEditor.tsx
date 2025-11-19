import React from 'react';
import { LayoutSnapshot } from '../types/projectState';
import { SectionMap } from '../types/performance';
import { GridMapService } from '../engine/gridMapService';
import { GridPattern } from '../types/gridPattern';

interface GridEditorProps {
  activeLayout: LayoutSnapshot | null;
  currentStep: number;
  activeSection: SectionMap | null;
  gridPattern: GridPattern | null;
  onTogglePad: (step: number, row: number, col: number) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const getNoteName = (midiNote: number): string => {
  const note = NOTE_NAMES[midiNote % 12];
  const octave = Math.floor(midiNote / 12) - 2; // MIDI 60 is C3, so 0 is C-2
  return `${note}${octave}`;
};

export const GridEditor: React.FC<GridEditorProps> = ({
  activeLayout,
  currentStep,
  activeSection,
  gridPattern,
  onTogglePad,
}) => {
  // Generate 8x8 grid (rows 0-7, cols 0-7)
  // Visual: Row 7 is top, Row 0 is bottom
  const rows = Array.from({ length: 8 }, (_, i) => 7 - i);
  const cols = Array.from({ length: 8 }, (_, i) => i);

  if (!activeSection) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        No active section configured for this step.
      </div>
    );
  }

  return (
    <div className="grid grid-rows-8 gap-1 bg-slate-900 p-4 rounded-lg shadow-xl select-none">
      {rows.map((row) => (
        <div key={`row-${row}`} className="grid grid-cols-8 gap-1">
          {cols.map((col) => {
            const noteNumber = GridMapService.getNoteForPosition(
              row,
              col,
              activeSection.instrumentConfig
            );
            
            const isActive = gridPattern?.steps[currentStep]?.[row]?.[col] ?? false;
            const noteName = getNoteName(noteNumber);

            return (
              <div
                key={`pad-${row}-${col}`}
                className={`
                  w-12 h-12 flex items-center justify-center rounded cursor-pointer transition-all duration-75
                  ${isActive 
                    ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)] scale-95' 
                    : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                  }
                `}
                onClick={() => onTogglePad(currentStep, row, col)}
                title={`Note: ${noteNumber} (${noteName}) | Row: ${row}, Col: ${col}`}
              >
                <span className="text-xs font-medium">{noteName}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

