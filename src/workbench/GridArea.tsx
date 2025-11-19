import React from 'react';
import { GridEditor } from './GridEditor';
import { LayoutSnapshot } from '../types/projectState';
import { SectionMap } from '../types/performance';
import { GridPattern } from '../types/gridPattern';

interface GridAreaProps {
  activeLayout: LayoutSnapshot | null;
  currentStep: number;
  activeSection: SectionMap | null;
  gridPattern: GridPattern;
  onTogglePad: (step: number, row: number, col: number) => void;
  showDebugLabels: boolean;
  viewAllSteps: boolean;
}

export const GridArea: React.FC<GridAreaProps> = ({
  activeLayout,
  currentStep,
  activeSection,
  gridPattern,
  onTogglePad,
  showDebugLabels,
  viewAllSteps,
}) => {
  return (
    <div id="grid-area" className="flex-1 bg-slate-950 p-8 flex items-center justify-center border-b border-border relative overflow-hidden">
      <GridEditor
        activeLayout={activeLayout}
        currentStep={currentStep}
        activeSection={activeSection}
        gridPattern={gridPattern}
        onTogglePad={onTogglePad}
        showDebugLabels={showDebugLabels}
        viewAllSteps={viewAllSteps}
      />
    </div>
  );
};
