/**
 * Mutation Service for Simulated Annealing Solver
 * 
 * Provides functions to mutate GridMapping configurations by moving or swapping
 * Voice assignments on the 8x8 grid. All mutations return new immutable objects
 * to preserve history and prevent state corruption.
 */

import { GridMapping, Voice, cellKey, parseCellKey } from '../../types/layout';

/**
 * PadCoord: Represents a Pad coordinate on the 8x8 grid.
 * Row 0 is bottom, Row 7 is top. Col 0 is left, Col 7 is right.
 */
export interface PadCoord {
  row: number;
  col: number;
}

/**
 * Returns a list of all 8x8 Pad coordinates that do not currently have a Voice assigned.
 * 
 * @param mapping - The GridMapping to analyze
 * @returns Array of PadCoord objects representing empty pads
 */
export function getEmptyPads(mapping: GridMapping): PadCoord[] {
  const emptyPads: PadCoord[] = [];
  
  // Iterate through all 64 pads (8 rows x 8 columns)
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const key = cellKey(row, col);
      // If this pad key is not in the cells mapping, it's empty
      if (!(key in mapping.cells)) {
        emptyPads.push({ row, col });
      }
    }
  }
  
  return emptyPads;
}

/**
 * Gets a list of all occupied Pad coordinates (pads that have a Voice assigned).
 * 
 * @param mapping - The GridMapping to analyze
 * @returns Array of PadCoord objects representing occupied pads
 */
function getOccupiedPads(mapping: GridMapping): PadCoord[] {
  const occupiedPads: PadCoord[] = [];
  
  // Iterate through all pad keys in the cells mapping
  for (const key of Object.keys(mapping.cells)) {
    const coord = parseCellKey(key);
    if (coord) {
      occupiedPads.push(coord);
    }
  }
  
  return occupiedPads;
}

/**
 * Applies a random mutation to a GridMapping by either swapping two Voices
 * or moving a Voice to an empty pad.
 * 
 * Mutation operations (50/50 chance):
 * - Swap: Pick two occupied pads at random and swap their assigned Voices
 * - Move: Pick one occupied pad and one empty pad, move the Voice to the empty slot
 * 
 * @param mapping - The GridMapping to mutate
 * @returns A new GridMapping with the mutation applied (immutable)
 */
export function applyRandomMutation(mapping: GridMapping): GridMapping {
  const occupiedPads = getOccupiedPads(mapping);
  const emptyPads = getEmptyPads(mapping);
  
  // Need at least one occupied pad to perform any mutation
  if (occupiedPads.length === 0) {
    return mapping; // No mutations possible, return original
  }
  
  // Randomly choose between swap and move operations
  const useSwap = Math.random() < 0.5;
  
  if (useSwap && occupiedPads.length >= 2) {
    // Swap Operation: Pick two occupied pads and swap their Voices
    const [pad1, pad2] = getRandomPair(occupiedPads);
    return applySwapMutation(mapping, pad1, pad2);
  } else if (emptyPads.length > 0) {
    // Move Operation: Pick one occupied pad and one empty pad, move the Voice
    const sourcePad = getRandomElement(occupiedPads);
    const targetPad = getRandomElement(emptyPads);
    return applyMoveMutation(mapping, sourcePad, targetPad);
  } else {
    // No empty pads available, fall back to swap if possible
    if (occupiedPads.length >= 2) {
      const [pad1, pad2] = getRandomPair(occupiedPads);
      return applySwapMutation(mapping, pad1, pad2);
    }
    // No mutations possible, return original
    return mapping;
  }
}

/**
 * Applies a swap mutation: swaps the Voices assigned to two pads.
 * 
 * @param mapping - The GridMapping to mutate
 * @param pad1 - First pad coordinate
 * @param pad2 - Second pad coordinate
 * @returns A new GridMapping with the swap applied
 */
function applySwapMutation(
  mapping: GridMapping,
  pad1: PadCoord,
  pad2: PadCoord
): GridMapping {
  const key1 = cellKey(pad1.row, pad1.col);
  const key2 = cellKey(pad2.row, pad2.col);
  
  const voice1 = mapping.cells[key1];
  const voice2 = mapping.cells[key2];
  
  // If either pad is empty, this is invalid for swap
  if (!voice1 || !voice2) {
    return mapping;
  }
  
  // Create new cells mapping with swapped Voices
  const newCells = { ...mapping.cells };
  newCells[key1] = voice2;
  newCells[key2] = voice1;
  
  // Preserve finger constraints (swap them too if they exist)
  const newFingerConstraints = { ...mapping.fingerConstraints };
  const constraint1 = mapping.fingerConstraints[key1];
  const constraint2 = mapping.fingerConstraints[key2];
  
  if (constraint1 !== undefined) {
    newFingerConstraints[key2] = constraint1;
  } else {
    delete newFingerConstraints[key2];
  }
  
  if (constraint2 !== undefined) {
    newFingerConstraints[key1] = constraint2;
  } else {
    delete newFingerConstraints[key1];
  }
  
  // Return new immutable GridMapping
  return {
    ...mapping,
    cells: newCells,
    fingerConstraints: newFingerConstraints,
    scoreCache: null, // Invalidate cached score after mutation
  };
}

/**
 * Applies a move mutation: moves a Voice from one pad to an empty pad.
 * 
 * @param mapping - The GridMapping to mutate
 * @param sourcePad - Source pad coordinate (must be occupied)
 * @param targetPad - Target pad coordinate (must be empty)
 * @returns A new GridMapping with the move applied
 */
function applyMoveMutation(
  mapping: GridMapping,
  sourcePad: PadCoord,
  targetPad: PadCoord
): GridMapping {
  const sourceKey = cellKey(sourcePad.row, sourcePad.col);
  const targetKey = cellKey(targetPad.row, targetPad.col);
  
  const voice = mapping.cells[sourceKey];
  
  // If source pad is empty, this is invalid
  if (!voice) {
    return mapping;
  }
  
  // If target pad is already occupied, this is invalid
  if (mapping.cells[targetKey]) {
    return mapping;
  }
  
  // Create new cells mapping with Voice moved
  const newCells = { ...mapping.cells };
  newCells[targetKey] = voice; // Move Voice to target
  delete newCells[sourceKey];  // Remove Voice from source
  
  // Preserve finger constraint if it exists
  const newFingerConstraints = { ...mapping.fingerConstraints };
  const constraint = mapping.fingerConstraints[sourceKey];
  
  if (constraint !== undefined) {
    newFingerConstraints[targetKey] = constraint;
    delete newFingerConstraints[sourceKey];
  } else {
    delete newFingerConstraints[targetKey];
  }
  
  // Return new immutable GridMapping
  return {
    ...mapping,
    cells: newCells,
    fingerConstraints: newFingerConstraints,
    scoreCache: null, // Invalidate cached score after mutation
  };
}

/**
 * Helper function to get a random element from an array.
 */
function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Helper function to get two distinct random elements from an array.
 */
function getRandomPair<T>(array: T[]): [T, T] {
  if (array.length < 2) {
    throw new Error('Array must have at least 2 elements to get a pair');
  }
  
  const index1 = Math.floor(Math.random() * array.length);
  let index2 = Math.floor(Math.random() * array.length);
  
  // Ensure indices are different
  while (index2 === index1) {
    index2 = Math.floor(Math.random() * array.length);
  }
  
  return [array[index1], array[index2]];
}

