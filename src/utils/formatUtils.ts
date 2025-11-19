/**
 * Formatting utilities for display purposes.
 */

/**
 * Formats a finger assignment as a string like "L1", "R5".
 * 
 * @param hand - 'L' for Left Hand, 'R' for Right Hand
 * @param finger - Finger ID (1-5)
 * @returns Formatted string like "L1", "R5"
 */
export function formatFinger(hand: 'L' | 'R', finger: number): string {
  return `${hand}${finger}`;
}

/**
 * Converts hand notation from 'LH'/'RH' to 'L'/'R'.
 * 
 * @param hand - 'LH' or 'RH'
 * @returns 'L' or 'R'
 */
export function normalizeHand(hand: 'LH' | 'RH'): 'L' | 'R' {
  return hand === 'LH' ? 'L' : 'R';
}

