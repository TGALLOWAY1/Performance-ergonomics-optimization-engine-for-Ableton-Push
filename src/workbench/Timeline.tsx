import React, { useRef, useEffect, useState } from 'react';
import { SectionMap } from '../types/performance';

interface TimelineProps {
  steps: number;
  currentStep: number;
  onStepSelect: (step: number) => void;
  sectionMaps: SectionMap[];
}

const STEPS_PER_MEASURE = 16; // Assuming 4/4 time signature and 16th notes
const MIN_STEP_WIDTH = 12; // Minimum width per step in pixels
const DEFAULT_STEPS = 64; // Default to 4 bars (64 steps at 16th note resolution)

export const Timeline: React.FC<TimelineProps> = ({
  steps: inputSteps,
  currentStep,
  onStepSelect,
  sectionMaps,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [stepWidth, setStepWidth] = useState(0);

  // Ensure minimum of 64 steps (4 bars) for default duration
  const steps = Math.max(inputSteps || DEFAULT_STEPS, DEFAULT_STEPS);
  const totalMeasures = Math.ceil(steps / STEPS_PER_MEASURE);

  // Calculate responsive step width
  useEffect(() => {
    const updateStepWidth = () => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const availableWidth = container.clientWidth;
        const calculatedWidth = availableWidth / steps;
        const finalWidth = Math.max(calculatedWidth, MIN_STEP_WIDTH);
        setContainerWidth(availableWidth);
        setStepWidth(finalWidth);
      }
    };

    updateStepWidth();
    const resizeObserver = new ResizeObserver(updateStepWidth);
    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [steps]);

  // Auto-scroll to keep current step in view
  useEffect(() => {
    if (scrollContainerRef.current && stepWidth > 0) {
      const container = scrollContainerRef.current;
      const targetScroll = (currentStep * stepWidth) - (container.clientWidth / 2) + (stepWidth / 2);
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [currentStep, stepWidth]);

  // Calculate if we need scrolling (when steps hit min-width)
  const needsScrolling = stepWidth === MIN_STEP_WIDTH;
  const totalWidth = steps * stepWidth;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Ruler / Measures */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-hidden relative bg-slate-950 border border-slate-800 rounded ${needsScrolling ? 'overflow-x-auto' : 'overflow-x-hidden'}`}
      >
        <div 
          ref={stepsContainerRef}
          className="relative h-full w-full"
          style={{ 
            width: needsScrolling ? `${totalWidth}px` : '100%',
            minWidth: '100%'
          }}
        >
          {/* Section Backgrounds */}
          {sectionMaps.map((section) => {
            const startStep = (section.startMeasure - 1) * STEPS_PER_MEASURE;
            const endStep = section.endMeasure * STEPS_PER_MEASURE;
            const width = (endStep - startStep) * stepWidth;
            const left = startStep * stepWidth;

            return (
              <div
                key={section.id}
                className="absolute top-0 bottom-0 bg-blue-900/20 border-l border-r border-blue-900/30 pointer-events-none z-0"
                style={{ 
                  left: `${left}px`, 
                  width: `${width}px`,
                  minWidth: needsScrolling ? `${width}px` : undefined
                }}
              >
                <div className="absolute top-1 left-2 text-xs text-blue-400/50 font-mono truncate">
                  {section.instrumentConfig.name}
                </div>
              </div>
            );
          })}

          {/* Measure Markers (Bar Lines) */}
          {Array.from({ length: totalMeasures }).map((_, i) => {
            const measureLeft = i * STEPS_PER_MEASURE * stepWidth;
            return (
              <div
                key={`measure-${i}`}
                className="absolute top-0 bottom-0 border-l-2 border-slate-600 pointer-events-none z-10"
                style={{ left: `${measureLeft}px` }}
              >
                <span className="absolute top-0 left-1 text-xs text-slate-500 font-mono font-semibold">
                  {i + 1}
                </span>
              </div>
            );
          })}

          {/* Steps */}
          <div className="absolute bottom-0 left-0 h-12 flex items-end w-full" style={{ width: needsScrolling ? `${totalWidth}px` : '100%' }}>
            {Array.from({ length: steps }).map((_, i) => {
              const isMeasureStart = i % STEPS_PER_MEASURE === 0;
              const isBeatStart = i % 4 === 0;
              
              return (
                <div
                  key={`step-${i}`}
                  className={`
                    relative h-8 border-r border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors flex-shrink-0
                    ${i === currentStep ? 'bg-blue-600 hover:bg-blue-500' : ''}
                  `}
                  style={{ 
                    width: needsScrolling ? `${MIN_STEP_WIDTH}px` : `${stepWidth}px`,
                    minWidth: `${MIN_STEP_WIDTH}px`
                  }}
                  onClick={() => onStepSelect(i)}
                >
                  {/* Bar Line Marker (every 16 steps) */}
                  {isMeasureStart && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-500 z-20" />
                  )}
                  
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

