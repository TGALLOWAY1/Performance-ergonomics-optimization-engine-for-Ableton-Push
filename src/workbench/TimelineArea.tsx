import React from 'react';
import { Timeline } from './Timeline';
import { SectionMap } from '../types/performance';

interface TimelineAreaProps {
  steps: number;
  currentStep: number;
  onStepSelect: (step: number) => void;
  sectionMaps: SectionMap[];
}

export const TimelineArea: React.FC<TimelineAreaProps> = ({
  steps,
  currentStep,
  onStepSelect,
  sectionMaps,
}) => {
  return (
    <div id="timeline-area" className="h-full bg-slate-900 p-4 border-t border-border flex flex-col">
      <div className="flex-1 min-h-0">
        <Timeline
          steps={steps}
          currentStep={currentStep}
          onStepSelect={onStepSelect}
          sectionMaps={sectionMaps}
        />
      </div>
    </div>
  );
};
