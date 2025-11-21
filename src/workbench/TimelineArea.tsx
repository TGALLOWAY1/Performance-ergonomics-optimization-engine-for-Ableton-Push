import React from 'react';
import { Timeline } from './Timeline';
import { SectionMap } from '../types/performance';

interface TimelineAreaProps {
  steps: number;
  currentStep: number;
  onStepSelect: (step: number) => void;
  sectionMaps: SectionMap[];
  /** View Settings: View all steps (flatten time) */
  viewAllSteps?: boolean;
  /** W2: Callback to update section map boundaries */
  onUpdateSectionMeasure?: (id: string, field: 'startMeasure' | 'lengthInMeasures', value: number) => void;
}

export const TimelineArea: React.FC<TimelineAreaProps> = ({
  steps,
  currentStep,
  onStepSelect,
  sectionMaps,
  viewAllSteps = false,
  onUpdateSectionMeasure,
}) => {
  // DEBUG: Log props on every render to verify data flow
  console.log('[TimelineArea] Props received:', {
    steps,
    currentStep,
    sectionMapsCount: sectionMaps.length,
    viewAllSteps,
  });
  
  return (
    <div 
      id="timeline-area" 
      className={`h-full bg-slate-900 p-4 border-t border-border flex flex-col ${viewAllSteps ? 'overflow-x-auto' : 'overflow-hidden'}`}
      style={{ 
        minHeight: '150px', // CSS Safety: Ensure timeline area has minimum height
        height: '100%' // Ensure height is defined, not collapsing to 0
      }}
    >
      <div 
        className={`flex-1 min-h-0 ${viewAllSteps ? 'overflow-x-auto' : ''}`}
        style={{ 
          minHeight: '100px' // CSS Safety: Ensure inner container has minimum height
        }}
      >
        <Timeline
          steps={steps}
          currentStep={currentStep}
          onStepSelect={onStepSelect}
          sectionMaps={sectionMaps}
          viewAllSteps={viewAllSteps}
          onUpdateSectionMeasure={onUpdateSectionMeasure}
        />
      </div>
    </div>
  );
};
