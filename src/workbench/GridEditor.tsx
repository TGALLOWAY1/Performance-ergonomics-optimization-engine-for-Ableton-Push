import React from 'react';
import { LayoutSnapshot } from '../types/projectState';
import { SectionMap } from '../types/performance';
import { GridMapService } from '../engine/gridMapService';
import { GridPattern } from '../types/gridPattern';
import { EngineResult, EngineDebugEvent, DifficultyLabel } from '../engine/runEngine';
import { formatFinger, normalizeHand } from '../utils/formatUtils';

interface GridEditorProps {
  activeLayout: LayoutSnapshot | null;
  currentStep: number;
  activeSection: SectionMap | null;
  gridPattern: GridPattern | null;
  onTogglePad: (step: number, row: number, col: number) => void;
  showDebugLabels: boolean;
  /** When true, ignore step time and show any pad that appears in performance.events as active. */
  viewAllSteps: boolean;
  engineResult: EngineResult | null;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const getNoteName = (midiNote: number): string => {
  const note = NOTE_NAMES[midiNote % 12];
  const octave = Math.floor(midiNote / 12) - 2; // MIDI 60 is C3, so 0 is C-2
  return `${note}${octave}`;
};

const DIFFICULTY_RANK: Record<DifficultyLabel, number> = {
  'Easy': 0,
  'Medium': 1,
  'Hard': 2,
  'Unplayable': 3
};

export const GridEditor: React.FC<GridEditorProps> = ({
  activeLayout,
  currentStep,
  activeSection,
  gridPattern,
  onTogglePad,
  showDebugLabels,
  viewAllSteps,
  engineResult
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

  // Helper to find relevant debug event for a pad
  const getDebugEventForPad = (row: number, col: number): EngineDebugEvent | null => {
    if (!engineResult) return null;

    const noteNumber = GridMapService.getNoteForPosition(row, col, activeSection.instrumentConfig);
    
    // Filter events for this specific note
    const noteEvents = engineResult.debugEvents.filter(e => e.noteNumber === noteNumber);
    
    if (noteEvents.length === 0) return null;

    if (viewAllSteps) {
      // Find the worst difficulty across all occurrences
      return noteEvents.reduce((worst, current) => {
        if (DIFFICULTY_RANK[current.difficulty] > DIFFICULTY_RANK[worst.difficulty]) {
          return current;
        }
        return worst;
      }, noteEvents[0]);
    } else {
      // Find event matching current step time
      // We need to approximate the time window for the current step
      // Assuming 16th notes at 120 BPM for now as a simplification, or use gridPattern logic
      // Ideally we'd pass the exact time window, but for now let's match loosely if we can
      // Or better: check if the pad is active in the gridPattern for this step, 
      // and if so, find the event that corresponds to this step index.
      
      // Since gridPattern is step-based, let's try to map step to time
      // This is tricky without exact quantization info, but let's try:
      // If the pad is active at this step, we want to show its difficulty.
      // But we don't easily know WHICH event index corresponds to this step without re-calculating.
      
      // Fallback: If the pad is active in the UI, show the worst case for that note to be safe?
      // Or try to find an event close to the step time.
      // Let's use the "worst case" logic for now even in single step mode if multiple exist,
      // as it's safer to show the problem than hide it.
      // But strictly, we should filter by time.
      
      // Let's just return the worst case for this note for now to ensure visibility of issues.
      return noteEvents.reduce((worst, current) => {
        if (DIFFICULTY_RANK[current.difficulty] > DIFFICULTY_RANK[worst.difficulty]) {
          return current;
        }
        return worst;
      }, noteEvents[0]);
    }
  };

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
              const debugEvent = isActive ? getDebugEventForPad(row, col) : null;

              // Compute styling based on difficulty
              let difficultyStyle = '';
              let dynamicStyle: React.CSSProperties | undefined;

              if (isActive) {
                if (debugEvent) {
                  switch (debugEvent.difficulty) {
                    case 'Unplayable':
                      difficultyStyle = 'bg-red-900/80 border-red-500 border-4 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)]';
                      break;
                    case 'Hard':
                      difficultyStyle = 'bg-orange-900/80 border-orange-500 border-4 text-white shadow-[0_0_15px_rgba(249,115,22,0.6)]';
                      break;
                    case 'Medium':
                      difficultyStyle = 'bg-yellow-900/60 border-yellow-500 border-2 text-white shadow-[0_0_10px_rgba(234,179,8,0.4)]';
                      break;
                    case 'Easy':
                    default:
                      difficultyStyle = 'bg-blue-500 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]';
                      break;
                  }
                } else {
                  // Default active style if no debug info (e.g. newly added note not yet processed)
                  difficultyStyle = 'bg-blue-500 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]';
                }
              } else {
                difficultyStyle = 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700 hover:border-slate-600 hover:text-slate-300';
              }

              // Override with gradient if viewAllSteps is on AND it's not a high difficulty note
              // We want to preserve the red/orange warnings even in viewAllSteps mode
              if (viewAllSteps && padOrderIndex !== null && totalEvents > 1 && (!debugEvent || debugEvent.difficulty === 'Easy')) {
                const t = padOrderIndex / (totalEvents - 1); // 0..1
                const hue = 210 - t * 80; // blue-ish to green-ish
                const lightness = 45 + t * 10; // slightly brighter over time
                dynamicStyle = {
                  backgroundColor: `hsl(${hue}, 80%, ${lightness}%)`,
                };
              }

              // Tooltip content
              let tooltip = `Note: ${noteNumber} (${noteName}) | Row: ${row}, Col: ${col}`;
              if (debugEvent && debugEvent.difficulty !== 'Easy') {
                tooltip += `\nDifficulty: ${debugEvent.difficulty}`;
                tooltip += `\nCost: ${debugEvent.cost.toFixed(2)}`;
                tooltip += `\nHand: ${debugEvent.assignedHand}`;
                if (debugEvent.finger && debugEvent.assignedHand !== 'Unplayable') {
                  const hand = normalizeHand(debugEvent.assignedHand);
                  tooltip += `\nFinger: ${formatFinger(hand, debugEvent.finger)}`;
                }
              }

              return (
                <div
                  key={`pad-${row}-${col}`}
                  className={`
                    w-16 h-16 flex flex-col items-center justify-center rounded-md cursor-pointer transition-all duration-100 relative border
                    ${difficultyStyle}
                    ${isActive ? 'scale-95' : ''}
                  `}
                  style={dynamicStyle}
                  onClick={() => onTogglePad(currentStep, row, col)}
                  title={tooltip}
                >
                  <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {noteName}
                  </span>
                  
                  {/* Finger Badge */}
                  {isActive && debugEvent && debugEvent.finger && debugEvent.assignedHand !== 'Unplayable' && (
                    <div className={`
                      absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm
                      ${debugEvent.assignedHand === 'LH' ? 'bg-blue-200 text-blue-900' : 'bg-red-200 text-red-900'}
                    `}>
                      {formatFinger(normalizeHand(debugEvent.assignedHand), debugEvent.finger)}
                    </div>
                  )}

                  {showDebugLabels && (
                    <div className="absolute bottom-1 left-0 right-0 flex flex-col items-center text-[9px] opacity-60 leading-tight pointer-events-none font-mono">
                      <span>{noteNumber}</span>
                      <span>[{row},{col}]</span>
                      {debugEvent && (
                        <span className={
                          debugEvent.difficulty === 'Unplayable' ? 'text-red-200 font-bold' :
                          debugEvent.difficulty === 'Hard' ? 'text-orange-200 font-bold' : ''
                        }>
                          {debugEvent.assignedHand}
                        </span>
                      )}
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
