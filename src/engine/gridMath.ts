/**
 * Represents a coordinate on the Push grid.
 * Row 0 is the bottom row, Row 7 is the top row.
 * Col 0 is the left column, Col 7 is the right column.
 */
export type GridPosition = {
  row: number;
  col: number;
};

/**
 * Calculates the Euclidean distance between two grid positions.
 * Used to estimate the physical travel distance for a hand.
 * 
 * Formula: sqrt((row2 - row1)^2 + (col2 - col1)^2)
 * 
 * @param a - The starting position.
 * @param b - The ending position.
 * @returns The Euclidean distance between the two points.
 */
export function calculateGridDistance(a: GridPosition, b: GridPosition): number {
  const rowDiff = b.row - a.row;
  const colDiff = b.col - a.col;
  return Math.sqrt((rowDiff * rowDiff) + (colDiff * colDiff));
}

