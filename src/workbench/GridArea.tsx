import React from 'react';
import { GridEditor } from './GridEditor';
import { LayoutSnapshot } from '../types/projectState';
import { SectionMap } from '../types/performance';
import { GridPattern } from '../types/gridPattern';
import { EngineResult } from '../engine/runEngine';

interface GridAreaProps {
  activeLayout: LayoutSnapshot | null;
  currentStep: number;
  activeSection: SectionMap | null;
  gridPattern: GridPattern;
  onTogglePad: (step: number, row: number, col: number) => void;
  showDebugLabels: boolean;
  viewAllSteps: boolean;
  engineResult: EngineResult | null;
}

export const GridArea: React.FC<GridAreaProps> = ({
  activeLayout,
  currentStep,
  activeSection,
  gridPattern,
  onTogglePad,
  showDebugLabels,
  viewAllSteps,
  engineResult
}) => {
  return (
    <div id="grid-area" className="w-full h-full flex items-center justify-center relative">
      <GridEditor
        activeLayout={activeLayout}
        currentStep={currentStep}
        activeSection={activeSection}
        gridPattern={gridPattern}
        onTogglePad={onTogglePad}
        showDebugLabels={showDebugLabels}
        viewAllSteps={viewAllSteps}
        engineResult={engineResult}
      />
    </div>
  );
};
