import React from 'react';
import { GridEditor } from './GridEditor';
import { LayoutSnapshot } from '../types/projectState';
import { SectionMap } from '../types/performance';
import { GridPattern } from '../types/gridPattern';
import { EngineResult } from '../engine/runEngine';

import { GridMapping } from '../types/layout';

interface GridAreaProps {
  activeLayout: LayoutSnapshot | null;
  currentStep: number;
  activeSection: SectionMap | null;
  gridPattern: GridPattern;
  onTogglePad: (step: number, row: number, col: number) => void;
  showDebugLabels: boolean;
  viewAllSteps: boolean;
  engineResult: EngineResult | null;
  activeMapping?: GridMapping | null;
  readOnly?: boolean;
  highlightedCell?: { row: number; col: number } | null;
}

export const GridArea: React.FC<GridAreaProps> = ({
  activeLayout,
  currentStep,
  activeSection,
  gridPattern,
  onTogglePad,
  showDebugLabels,
  viewAllSteps,
  engineResult,
  activeMapping,
  readOnly = false,
  highlightedCell = null
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
        activeMapping={activeMapping}
        readOnly={readOnly}
        highlightedCell={highlightedCell}
      />
    </div>
  );
};
