import React, { useRef, useEffect } from 'react';
import { SectionMap } from '../types/performance';

interface TimelineProps {
  steps: number;
  currentStep: number;
  onStepSelect: (step: number) => void;
  sectionMaps: SectionMap[];
}

const STEPS_PER_MEASURE = 16; // Assuming 4/4 time signature and 16th notes
const STEP_WIDTH = 24; // Width of each step in pixels

export const Timeline: React.FC<TimelineProps> = ({
  steps,
  currentStep,
  onStepSelect,
  sectionMaps,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep current step in view
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const targetScroll = (currentStep * STEP_WIDTH) - (container.clientWidth / 2) + (STEP_WIDTH / 2);
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [currentStep]);

  // Calculate total width based on steps
  const totalWidth = steps * STEP_WIDTH;
  const totalMeasures = Math.ceil(steps / STEPS_PER_MEASURE);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Ruler / Measures */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative bg-slate-950 border border-slate-800 rounded"
      >
        <div 
          className="relative h-full"
          style={{ width: `${totalWidth}px`, minWidth: '100%' }}
        >
          {/* Section Backgrounds */}
          {sectionMaps.map((section) => {
            const startStep = (section.startMeasure - 1) * STEPS_PER_MEASURE;
            const endStep = section.endMeasure * STEPS_PER_MEASURE;
            const width = (endStep - startStep) * STEP_WIDTH;
            const left = startStep * STEP_WIDTH;

            return (
              <div
                key={section.id}
                className="absolute top-0 bottom-0 bg-blue-900/20 border-l border-r border-blue-900/30 pointer-events-none"
                style={{ left: `${left}px`, width: `${width}px` }}
              >
                <div className="absolute top-1 left-2 text-xs text-blue-400/50 font-mono truncate">
                  {section.instrumentConfig.name}
                </div>
              </div>
            );
          })}

          {/* Measure Markers */}
          {Array.from({ length: totalMeasures }).map((_, i) => (
            <div
              key={`measure-${i}`}
              className="absolute top-0 bottom-0 border-l border-slate-700 pointer-events-none"
              style={{ left: `${i * STEPS_PER_MEASURE * STEP_WIDTH}px` }}
            >
              <span className="absolute top-0 left-1 text-xs text-slate-500 font-mono">
                {i + 1}
              </span>
            </div>
          ))}

          {/* Steps */}
          <div className="absolute bottom-0 left-0 right-0 h-12 flex items-end">
            {Array.from({ length: steps }).map((_, i) => {
              const isMeasureStart = i % STEPS_PER_MEASURE === 0;
              const isBeatStart = i % 4 === 0;
              
              return (
                <div
                  key={`step-${i}`}
                  className={`
                    relative h-8 border-r border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors
                    ${i === currentStep ? 'bg-blue-600 hover:bg-blue-500' : ''}
                    ${isMeasureStart ? 'border-l-2 border-l-slate-600' : ''}
                  `}
                  style={{ width: `${STEP_WIDTH}px` }}
                  onClick={() => onStepSelect(i)}
                >
                  {/* Step Number (every 4 steps) */}
                  {isBeatStart && (
                    <span className={`
                      absolute bottom-1 left-1 text-[10px] font-mono pointer-events-none
                      ${i === currentStep ? 'text-white' : 'text-slate-600'}
                    `}>
                      {(i % STEPS_PER_MEASURE) / 4 + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

