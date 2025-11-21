import React, { useRef, useEffect, useState, useMemo } from 'react';
import { SectionMap } from '../data/models';

interface TimelineProps {
  steps: number;
  currentStep: number;
  onStepSelect: (step: number) => void;
  sectionMaps: SectionMap[];
  /** View Settings: View all steps (flatten time) */
  viewAllSteps?: boolean;
  /** W2: Callback to update section map boundaries */
  onUpdateSectionMeasure?: (id: string, field: 'startMeasure' | 'lengthInMeasures', value: number) => void;
}

const STEPS_PER_MEASURE = 16; // Assuming 4/4 time signature and 16th notes
const MIN_STEP_WIDTH = 12; // Minimum width per step in pixels
const MIN_NOTE_BLOCK_WIDTH = 2; // CSS Safety: Minimum width for note blocks (prevents invisible notes)
const DEFAULT_NOTE_COLOR = '#FFFFFF'; // CSS Safety: High-contrast fallback color for notes
const DEFAULT_STEPS = 64; // Default to 4 bars (64 steps at 16th note resolution)
const OVERVIEW_PROJECT_LENGTH = 32; // Always show 32 bars in overview (512 steps)
const VIEWPORT_SIZE_MEASURES = 4; // Default viewport size: 4 bars (can be changed to 4 or 8)
const TIMELINE_MIN_HEIGHT = 150; // CSS Safety: Minimum height for timeline container (px)

/**
 * CSS Safety Utility: Ensures note block has minimum width and color fallback
 * Use this when rendering note events as blocks on the timeline
 */
const getSafeNoteBlockStyle = (
  width: number,
  color?: string
): React.CSSProperties => {
  return {
    width: `${Math.max(width, MIN_NOTE_BLOCK_WIDTH)}px`,
    backgroundColor: color || DEFAULT_NOTE_COLOR,
    minHeight: '4px', // Ensure note blocks have visible height
  };
};

export const Timeline: React.FC<TimelineProps> = ({
  steps: inputSteps,
  currentStep,
  onStepSelect,
  sectionMaps,
  viewAllSteps = false,
  onUpdateSectionMeasure,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const overviewStripRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [stepWidth, setStepWidth] = useState(0);
  const [viewportStartMeasure, setViewportStartMeasure] = useState(1); // Which measure the viewport starts at
  const [viewportSizeMeasures, setViewportSizeMeasures] = useState(VIEWPORT_SIZE_MEASURES); // 4 or 8 bars

  // Ensure minimum of 64 steps (4 bars) for default duration
  const steps = Math.max(inputSteps || DEFAULT_STEPS, DEFAULT_STEPS);
  const totalMeasures = Math.ceil(steps / STEPS_PER_MEASURE);
  
  // Project length for overview: use actual project length or 32 bars, whichever is larger
  const projectLengthMeasures = Math.max(totalMeasures, OVERVIEW_PROJECT_LENGTH);
  const projectLengthSteps = projectLengthMeasures * STEPS_PER_MEASURE;
  
  // Clamp viewport to project bounds
  const clampedViewportStartMeasure = useMemo(() => {
    const maxStart = Math.max(1, projectLengthMeasures - viewportSizeMeasures + 1);
    return Math.max(1, Math.min(viewportStartMeasure, maxStart));
  }, [viewportStartMeasure, projectLengthMeasures, viewportSizeMeasures]);
  
  // Viewport calculations (use clamped value)
  const viewportStartStep = (clampedViewportStartMeasure - 1) * STEPS_PER_MEASURE;
  const viewportSizeSteps = viewportSizeMeasures * STEPS_PER_MEASURE;
  const viewportEndStep = viewportStartStep + viewportSizeSteps; // Don't clamp - allow viewport to extend beyond project

  // Calculate responsive step width for viewport (only show viewportSizeSteps)
  useEffect(() => {
    const updateStepWidth = () => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const availableWidth = container.clientWidth;
        // Calculate width based on viewport size, not full project
        const calculatedWidth = availableWidth / viewportSizeSteps;
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
  }, [viewportSizeSteps]);

  // Auto-scroll viewport to keep current step in view
  useEffect(() => {
    if (currentStep < viewportStartStep || currentStep >= viewportEndStep) {
      // Current step is outside viewport, adjust viewport
      const targetMeasure = Math.floor(currentStep / STEPS_PER_MEASURE) + 1;
      const newViewportStart = Math.max(1, targetMeasure - Math.floor(viewportSizeMeasures / 2));
      setViewportStartMeasure(Math.min(newViewportStart, projectLengthMeasures - viewportSizeMeasures + 1));
    }
  }, [currentStep, viewportStartStep, viewportEndStep, viewportSizeMeasures, projectLengthMeasures]);

  // Handle overview strip click/drag to change viewport
  const [draggingOverview, setDraggingOverview] = useState(false);
  
  const handleOverviewClick = (e: React.MouseEvent) => {
    if (!overviewStripRef.current) return;
    const rect = overviewStripRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const overviewWidth = rect.width;
    const clickedMeasure = Math.floor((relativeX / overviewWidth) * projectLengthMeasures) + 1;
    const newViewportStart = Math.max(1, Math.min(clickedMeasure - Math.floor(viewportSizeMeasures / 2), projectLengthMeasures - viewportSizeMeasures + 1));
    setViewportStartMeasure(newViewportStart);
  };

  const handleOverviewMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingOverview(true);
    handleOverviewClick(e);
  };

  useEffect(() => {
    if (!draggingOverview) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!overviewStripRef.current) return;
      const rect = overviewStripRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const overviewWidth = rect.width;
      const clickedMeasure = Math.floor((relativeX / overviewWidth) * projectLengthMeasures) + 1;
      const newViewportStart = Math.max(1, Math.min(clickedMeasure - Math.floor(viewportSizeMeasures / 2), projectLengthMeasures - viewportSizeMeasures + 1));
      setViewportStartMeasure(newViewportStart);
    };

    const handleMouseUp = () => {
      setDraggingOverview(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingOverview, viewportSizeMeasures, projectLengthMeasures]);

  // W2: Handle dragging section boundaries
  const [draggingBoundary, setDraggingBoundary] = useState<{
    sectionId: string;
    type: 'start' | 'end';
  } | null>(null);

  const handleBoundaryMouseDown = (e: React.MouseEvent, sectionId: string, type: 'start' | 'end') => {
    e.stopPropagation();
    if (!onUpdateSectionMeasure) return;
    setDraggingBoundary({ sectionId, type });
  };

  useEffect(() => {
    if (!draggingBoundary || !onUpdateSectionMeasure) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!scrollContainerRef.current || !stepsContainerRef.current) return;
      
      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - containerRect.left;
      // Convert relative position to absolute step, accounting for viewport offset
      const relativeStep = Math.floor(relativeX / stepWidth);
      const absoluteStep = viewportStartStep + relativeStep;
      const measure = Math.floor(absoluteStep / STEPS_PER_MEASURE) + 1;
      const clampedMeasure = Math.max(1, Math.min(measure, projectLengthMeasures));

      const section = sectionMaps.find(s => s.id === draggingBoundary.sectionId);
      if (!section) return;

      // Calculate endMeasure from startMeasure + lengthInMeasures
      const endMeasure = section.startMeasure + section.lengthInMeasures - 1;

      if (draggingBoundary.type === 'start') {
        if (clampedMeasure < endMeasure) {
          onUpdateSectionMeasure(section.id, 'startMeasure', clampedMeasure);
        }
      } else {
        // When dragging end boundary, calculate new lengthInMeasures
        if (clampedMeasure > section.startMeasure) {
          const newLength = clampedMeasure - section.startMeasure + 1;
          onUpdateSectionMeasure(section.id, 'lengthInMeasures', newLength);
        }
      }
    };

    const handleMouseUp = () => {
      setDraggingBoundary(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBoundary, onUpdateSectionMeasure, stepWidth, sectionMaps, projectLengthMeasures, viewportStartStep]);

  // Calculate viewport indicator position in overview strip
  const overviewViewportLeft = ((clampedViewportStartMeasure - 1) / projectLengthMeasures) * 100;
  const overviewViewportWidth = (viewportSizeMeasures / projectLengthMeasures) * 100;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Overview Strip - Always shows full 32-bar project */}
      <div className="flex-none h-16 bg-slate-800 border-b border-slate-700 relative">
        <div className="flex items-center gap-2 px-2 h-full">
          <span className="text-xs text-slate-400 font-mono whitespace-nowrap">Overview:</span>
          <div 
            ref={overviewStripRef}
            className="flex-1 h-10 bg-slate-900 rounded border border-slate-700 relative cursor-pointer overflow-hidden"
            onMouseDown={handleOverviewMouseDown}
          >
            {/* Section boundaries in overview */}
            {sectionMaps.map((section) => {
              const endMeasure = section.startMeasure + section.lengthInMeasures - 1;
              const sectionLeft = ((section.startMeasure - 1) / projectLengthMeasures) * 100;
              const sectionWidth = ((endMeasure - section.startMeasure + 1) / projectLengthMeasures) * 100;
              
              return (
                <div
                  key={`overview-section-${section.id}`}
                  className="absolute top-0 bottom-0 bg-blue-900/40 border-l border-r border-blue-700/50"
                  style={{
                    left: `${sectionLeft}%`,
                    width: `${Math.max(sectionWidth, 0.5)}%`, // CSS Safety: Minimum width (0.5% prevents invisible sections)
                    minHeight: '100%' // Ensure section has full height
                  }}
                  title={section.name || section.instrumentConfig.name}
                />
              );
            })}
            
            {/* Measure markers in overview */}
            {Array.from({ length: projectLengthMeasures }).map((_, i) => {
              const measureLeft = (i / projectLengthMeasures) * 100;
              return (
                <div
                  key={`overview-measure-${i}`}
                  className="absolute top-0 bottom-0 border-l border-slate-700/50"
                  style={{ left: `${measureLeft}%` }}
                />
              );
            })}
            
            {/* Viewport indicator (shows what's visible in main timeline) */}
            <div
              className="absolute top-0 bottom-0 bg-yellow-500/30 border-2 border-yellow-400 pointer-events-none z-10"
              style={{
                left: `${overviewViewportLeft}%`,
                width: `${Math.max(overviewViewportWidth, 0.5)}%`, // CSS Safety: Minimum width for viewport indicator
                minHeight: '100%', // Ensure viewport indicator has full height
                backgroundColor: overviewViewportWidth > 0 ? undefined : 'rgba(234, 179, 8, 0.3)' // CSS Safety: Color fallback
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-3 bg-yellow-400/50 flex items-center justify-center">
                <span className="text-[8px] font-mono text-yellow-200 font-semibold">
                  {clampedViewportStartMeasure}-{clampedViewportStartMeasure + viewportSizeMeasures - 1}
                </span>
              </div>
            </div>
            
            {/* Current step indicator in overview */}
            {currentStep >= 0 && currentStep < projectLengthSteps && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-blue-400 pointer-events-none z-20"
                style={{
                  left: `${(currentStep / projectLengthSteps) * 100}%`,
                  width: '2px', // CSS Safety: Explicit width (0.5px might be too thin on some displays)
                  minHeight: '100%', // Ensure indicator has full height
                  backgroundColor: '#60a5fa' // CSS Safety: Color fallback (blue-400)
                }}
              />
            )}
          </div>
          
          {/* Viewport size toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewportSizeMeasures(4)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewportSizeMeasures === 4
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title="4-bar viewport"
            >
              4
            </button>
            <button
              onClick={() => setViewportSizeMeasures(8)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewportSizeMeasures === 8
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title="8-bar viewport"
            >
              8
            </button>
          </div>
        </div>
      </div>

      {/* W2: Measure Ruler (Top) - Shows only viewport measures, aligned to actual step positions */}
      <div className="flex-none h-8 bg-slate-900 border-b border-slate-800 relative overflow-hidden">
        <div 
          className="relative h-full"
          style={{ 
            width: '100%',
            minWidth: '100%'
          }}
        >
          {/* Beat division markers (every 4 steps) */}
          {Array.from({ length: viewportSizeSteps }).map((_, i) => {
            const absoluteStep = viewportStartStep + i;
            const isBeatStart = absoluteStep % 4 === 0;
            const isMeasureStart = absoluteStep % STEPS_PER_MEASURE === 0;
            
            // Only show beat markers (not measure markers, those are handled separately)
            if (!isBeatStart || isMeasureStart) return null;
            
            const relativeStep = i;
            const beatLeft = relativeStep * stepWidth;
            
            return (
              <div
                key={`ruler-beat-${absoluteStep}`}
                className="absolute top-0 bottom-0 border-l border-slate-700/40"
                style={{ left: `${beatLeft}px` }}
              />
            );
          })}
          
          {/* Measure markers */}
          {Array.from({ length: viewportSizeMeasures }).map((_, i) => {
            const measureNumber = clampedViewportStartMeasure + i;
            // Calculate the actual step position for this measure start
            const measureStartStep = (measureNumber - 1) * STEPS_PER_MEASURE;
            // Only show if this measure start is within the viewport
            if (measureStartStep < viewportStartStep || measureStartStep >= viewportEndStep) {
              return null;
            }
            // Calculate pixel position relative to viewport start
            const relativeStep = measureStartStep - viewportStartStep;
            const measureLeft = relativeStep * stepWidth;
            
            return (
              <div
                key={`ruler-measure-${measureNumber}`}
                className="absolute top-0 bottom-0 border-l border-slate-700 z-10"
                style={{ left: `${measureLeft}px` }}
              >
                <span className="absolute top-1 left-1 text-xs text-slate-400 font-mono font-semibold">
                  {measureNumber}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline Content - Viewport (shows only viewportSizeMeasures bars) */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 relative bg-slate-950 border border-slate-800 rounded ${viewAllSteps ? 'overflow-x-auto' : 'overflow-hidden'}`}
        style={{ 
          minHeight: `${TIMELINE_MIN_HEIGHT}px`,
          height: '100%' // Ensure height is defined, not collapsing to 0
        }}
      >
        <div 
          ref={stepsContainerRef}
          className="relative h-full w-full"
          style={{ 
            width: '100%',
            minWidth: '100%'
          }}
        >
          {/* W2: Section Backgrounds with Editable Boundaries (only show sections in viewport) */}
          {sectionMaps.map((section) => {
            // Calculate endMeasure from startMeasure + lengthInMeasures
            const endMeasure = section.startMeasure + section.lengthInMeasures - 1;
            const sectionStartStep = (section.startMeasure - 1) * STEPS_PER_MEASURE;
            const sectionEndStep = endMeasure * STEPS_PER_MEASURE;
            
            // Check if section overlaps with viewport
            if (sectionEndStep < viewportStartStep || sectionStartStep >= viewportEndStep) {
              return null; // Section is outside viewport
            }
            
            // Calculate relative position within viewport
            const relativeStartStep = Math.max(0, sectionStartStep - viewportStartStep);
            const relativeEndStep = Math.min(viewportSizeSteps, sectionEndStep - viewportStartStep);
            const width = (relativeEndStep - relativeStartStep) * stepWidth;
            const left = relativeStartStep * stepWidth;

            return (
              <div
                key={section.id}
                className="absolute top-0 bottom-0 bg-blue-900/20 border-l border-r border-blue-900/30 z-0"
                style={{ 
                  left: `${left}px`, 
                  width: `${Math.max(width, MIN_NOTE_BLOCK_WIDTH)}px`, // CSS Safety: Minimum width for section blocks
                  minHeight: '100%' // Ensure section block has full height
                }}
              >
                <div className="absolute top-1 left-2 text-xs text-blue-400/50 font-mono truncate pointer-events-none">
                  {section.name || section.instrumentConfig.name}
                </div>
                
                {/* W2: Editable Start Boundary */}
                {onUpdateSectionMeasure && (
                  <>
                    <div
                      onMouseDown={(e) => handleBoundaryMouseDown(e, section.id, 'start')}
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/50 z-20"
                      style={{ cursor: draggingBoundary?.sectionId === section.id && draggingBoundary?.type === 'start' ? 'grabbing' : 'grab' }}
                    />
                    {/* W2: Editable End Boundary */}
                    <div
                      onMouseDown={(e) => handleBoundaryMouseDown(e, section.id, 'end')}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/50 z-20"
                      style={{ cursor: draggingBoundary?.sectionId === section.id && draggingBoundary?.type === 'end' ? 'grabbing' : 'grab' }}
                    />
                  </>
                )}
              </div>
            );
          })}

          {/* Measure Markers (Bar Lines) - Only show measures in viewport, aligned to actual step positions */}
          {Array.from({ length: viewportSizeMeasures }).map((_, i) => {
            const measureNumber = clampedViewportStartMeasure + i;
            // Calculate the actual step position for this measure start
            const measureStartStep = (measureNumber - 1) * STEPS_PER_MEASURE;
            // Only show if this measure start is within the viewport
            if (measureStartStep < viewportStartStep || measureStartStep >= viewportEndStep) {
              return null;
            }
            // Calculate pixel position relative to viewport start
            const relativeStep = measureStartStep - viewportStartStep;
            const measureLeft = relativeStep * stepWidth;
            
            return (
              <div
                key={`measure-${measureNumber}`}
                className="absolute top-0 bottom-0 border-l-2 border-slate-600 pointer-events-none z-10"
                style={{ left: `${measureLeft}px` }}
              >
                <span className="absolute top-0 left-1 text-xs text-slate-500 font-mono font-semibold">
                  {measureNumber}
                </span>
              </div>
            );
          })}

          {/* Steps - Only show steps in viewport */}
          <div 
            className="absolute bottom-0 left-0 h-12 flex items-end w-full" 
            style={{ 
              width: '100%',
              minHeight: '48px' // CSS Safety: Ensure step container has minimum height
            }}
          >
            {Array.from({ length: viewportSizeSteps }).map((_, i) => {
              const absoluteStep = viewportStartStep + i;
              // Check if step is within project bounds
              const isWithinProject = absoluteStep < steps;
              
              const isMeasureStart = absoluteStep % STEPS_PER_MEASURE === 0;
              const isBeatStart = absoluteStep % 4 === 0;
              const isCurrentStep = absoluteStep === currentStep;
              
              return (
                <div
                  key={`step-${absoluteStep}`}
                  className={`
                    relative h-8 border-r border-slate-800 transition-colors flex-shrink-0
                    ${isWithinProject ? 'cursor-pointer hover:bg-slate-800' : 'bg-slate-950 border-slate-900'}
                    ${isCurrentStep && isWithinProject ? 'bg-blue-600 hover:bg-blue-500' : ''}
                  `}
                  style={{ 
                    width: `${stepWidth}px`,
                    minWidth: `${MIN_STEP_WIDTH}px`,
                    // CSS Safety: Ensure step never collapses to 0 width
                    minHeight: '32px' // Ensure step has minimum height
                  }}
                  onClick={() => {
                    if (isWithinProject) {
                      onStepSelect(absoluteStep);
                    }
                  }}
                >
                  {/* Bar Line Marker (every 16 steps) */}
                  {isMeasureStart && (
                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 z-20 ${isWithinProject ? 'bg-slate-500' : 'bg-slate-800'}`} />
                  )}
                  
                  {/* Beat Division Marker (every 4 steps, but not on measure start) */}
                  {isBeatStart && !isMeasureStart && (
                    <div className={`absolute left-0 top-0 bottom-0 w-px z-15 ${isWithinProject ? 'bg-slate-600/60' : 'bg-slate-800/40'}`} />
                  )}
                  
                  {/* Step Number (every 4 steps) - only show if within project */}
                  {isBeatStart && isWithinProject && (
                    <span className={`
                      absolute bottom-1 left-1 text-[10px] font-mono pointer-events-none
                      ${isCurrentStep ? 'text-white' : 'text-slate-600'}
                    `}>
                      {(absoluteStep % STEPS_PER_MEASURE) / 4 + 1}
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

