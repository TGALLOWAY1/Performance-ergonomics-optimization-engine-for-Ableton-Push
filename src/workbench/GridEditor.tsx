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
  showDebugLabels: boolean;
  /** When true, ignore step time and show any pad that appears in performance.events as active. */
  viewAllSteps: boolean;
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
  showDebugLabels,
  viewAllSteps,
}) => {
  // Generate 8x8 grid (rows 0-7, cols 0-7)
  // Visual: Row 7 is top, Row 0 is bottom
  const rows = Array.from({ length: 8 }, (_, i) => 7 - i);
  const cols = Array.from({ length: 8 }, (_, i) => i);

  const performanceEvents = activeLayout?.performance?.events ?? [];
  const totalEvents = performanceEvents.length;

  if (!activeSection) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        No active section configured for this step.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div 
        className="grid grid-cols-8 gap-2 bg-slate-900 p-4 rounded-xl shadow-2xl border border-slate-800"
        style={{ width: 'fit-content' }}
      >
        {rows.map((row) => (
          <React.Fragment key={`row-${row}`}>
            {cols.map((col) => {
              const noteNumber = GridMapService.getNoteForPosition(
                row,
                col,
                activeSection.instrumentConfig
              );

              // Base per-step activation
              let isActive = gridPattern?.steps[currentStep]?.[row]?.[col] ?? false;
              let padOrderIndex: number | null = null;

              // When viewAllSteps is enabled, a pad is active if ANY event in the
              // performance maps to this pad (time is ignored). We also capture the
              // earliest event index for gradient shading.
              if (viewAllSteps && totalEvents > 0) {
                for (let i = 0; i < totalEvents; i += 1) {
                  const event = performanceEvents[i];
                  const pos = GridMapService.getPositionForNote(
                    event.noteNumber,
                    activeSection.instrumentConfig
                  );
                  if (pos !== null && pos.row === row && pos.col === col) {
                    padOrderIndex = i;
                    break;
                  }
                }
                isActive = padOrderIndex !== null;
              }

              const noteName = getNoteName(noteNumber);

              // Compute a simple gradient based on the pad's earliest event index
              let dynamicStyle: React.CSSProperties | undefined;
              if (viewAllSteps && padOrderIndex !== null && totalEvents > 1) {
                const t = padOrderIndex / (totalEvents - 1); // 0..1
                const hue = 210 - t * 80; // blue-ish to green-ish
                const lightness = 45 + t * 10; // slightly brighter over time
                dynamicStyle = {
                  backgroundColor: `hsl(${hue}, 80%, ${lightness}%)`,
                };
              }

              return (
                <div
                  key={`pad-${row}-${col}`}
                  className={`
                    w-16 h-16 flex flex-col items-center justify-center rounded-md cursor-pointer transition-all duration-100 relative border
                    ${isActive 
                      ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] scale-95' 
                      : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700 hover:border-slate-600 hover:text-slate-300'
                    }
                  `}
                  style={dynamicStyle}
                  onClick={() => onTogglePad(currentStep, row, col)}
                  title={`Note: ${noteNumber} (${noteName}) | Row: ${row}, Col: ${col}`}
                >
                  <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {noteName}
                  </span>
                  {showDebugLabels && (
                    <div className="absolute bottom-1 left-0 right-0 flex flex-col items-center text-[9px] opacity-60 leading-tight pointer-events-none font-mono">
                      <span>{noteNumber}</span>
                      <span>[{row},{col}]</span>
                    </div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
