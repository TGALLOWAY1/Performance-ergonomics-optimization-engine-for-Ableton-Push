import { NoteEvent } from '../types/performance';

/**
 * Sorts an array of NoteEvents by their startTime in ascending order.
 * 
 * @param events - The array of NoteEvents to sort.
 * @returns A new array of sorted NoteEvents. Does NOT mutate the original array.
 */
export const sortEventsByStartTime = (events: NoteEvent[]): NoteEvent[] => {
  return [...events].sort((a, b) => a.startTime - b.startTime);
};

/**
 * Generates a unique string ID with a given prefix.
 * 
 * @param prefix - The prefix to prepend to the ID.
 * @returns A unique string in the format `${prefix}_${timestamp}_${random}`.
 */
export const generateId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

