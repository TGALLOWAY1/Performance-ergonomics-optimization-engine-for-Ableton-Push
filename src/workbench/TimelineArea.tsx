import React from 'react';
import { Timeline } from './Timeline';
import { SectionMap } from '../data/models';

interface TimelineAreaProps {
  steps: number;
  currentStep: number;
  onStepSelect: (step: number) => void;
  sectionMaps: SectionMap[];
  /** W2: Callback to update section map boundaries */
  onUpdateSectionMeasure?: (id: string, field: 'startMeasure' | 'lengthInMeasures', value: number) => void;
}

export const TimelineArea: React.FC<TimelineAreaProps> = ({
  steps,
  currentStep,
  onStepSelect,
  sectionMaps,
  onUpdateSectionMeasure,
}) => {
  return (
    <div id="timeline-area" className="h-full bg-slate-900 p-4 border-t border-border flex flex-col">
      <div className="flex-1 min-h-0">
        <Timeline
          steps={steps}
          currentStep={currentStep}
          onStepSelect={onStepSelect}
          sectionMaps={sectionMaps}
          onUpdateSectionMeasure={onUpdateSectionMeasure}
        />
      </div>
    </div>
  );
};
