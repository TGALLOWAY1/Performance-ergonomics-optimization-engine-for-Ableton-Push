import { GridPattern } from '../types/gridPattern';

/**
 * Creates a new empty GridPattern with the specified number of steps.
 * Each step is initialized as an 8x8 grid of false values.
 * 
 * @param steps Number of steps in the pattern
 * @returns A new empty GridPattern
 */
export const createEmptyPattern = (steps: number): GridPattern => {
  const emptyGrid = Array(8).fill(null).map(() => Array(8).fill(false));
  
  // Deep copy the empty grid for each step to avoid reference issues
  const patternSteps = Array(steps).fill(null).map(() => 
    emptyGrid.map(row => [...row])
  );

  return {
    steps: patternSteps,
    length: steps
  };
};

/**
 * Toggles the state of a specific pad at a specific step.
 * Returns a new GridPattern instance (immutable update).
 * 
 * @param pattern The source pattern
 * @param step The step index (0-based)
 * @param row The row index (0-7)
 * @param col The column index (0-7)
 * @returns A new GridPattern with the updated state
 */
export const toggleStepPad = (
  pattern: GridPattern,
  step: number,
  row: number,
  col: number
): GridPattern => {
  if (step < 0 || step >= pattern.length) {
    return pattern;
  }
  if (row < 0 || row >= 8 || col < 0 || col >= 8) {
    return pattern;
  }

  // Deep copy the steps array
  const newSteps = pattern.steps.map((s, sIndex) => {
    if (sIndex !== step) return s;
    
    // For the target step, copy the grid
    return s.map((r, rIndex) => {
      if (rIndex !== row) return r;
      
      // For the target row, copy and toggle the column
      const newRow = [...r];
      newRow[col] = !newRow[col];
      return newRow;
    });
  });

  return {
    ...pattern,
    steps: newSteps
  };
};

