export interface GridPattern {
  /**
   * Array of steps in the pattern.
   * Each step is an 8x8 boolean matrix representing the grid state.
   * true = pad is active (note on), false = pad is inactive.
   */
  steps: boolean[][][];
  
  /**
   * Total number of steps in the pattern.
   */
  length: number;
}

