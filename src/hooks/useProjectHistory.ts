import { useState, useCallback, useRef, useEffect } from 'react';
import { ProjectState } from '../types/projectState';

interface UseProjectHistoryReturn {
  projectState: ProjectState;
  setProjectState: (state: ProjectState | ((prev: ProjectState) => ProjectState), skipHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

const MAX_HISTORY_SIZE = 50;

/**
 * Hook for managing undo/redo history of ProjectState.
 * Tracks past, present, and future states.
 */
export function useProjectHistory(initialState: ProjectState): UseProjectHistoryReturn {
  const [past, setPast] = useState<ProjectState[]>([]);
  const [present, setPresent] = useState<ProjectState>(initialState);
  const [future, setFuture] = useState<ProjectState[]>([]);

  // Track if we're currently undoing/redoing to avoid adding to history
  const isUndoingRef = useRef(false);
  const isRedoingRef = useRef(false);

  const setProjectState = useCallback((newStateOrFn: ProjectState | ((prev: ProjectState) => ProjectState), skipHistory = false) => {
    if (skipHistory || isUndoingRef.current || isRedoingRef.current) {
      setPresent(prev => {
        const newState = typeof newStateOrFn === 'function' ? (newStateOrFn as (prev: ProjectState) => ProjectState)(prev) : newStateOrFn;
        return newState;
      });
      return;
    }

    // Add current state to past
    setPast(prevPast => {
      const newPast = [...prevPast, present];
      // Limit history size
      if (newPast.length > MAX_HISTORY_SIZE) {
        return newPast.slice(-MAX_HISTORY_SIZE);
      }
      return newPast;
    });

    // Clear future when making a new change
    setFuture([]);
    setPresent(prev => {
      const newState = typeof newStateOrFn === 'function' ? (newStateOrFn as (prev: ProjectState) => ProjectState)(prev) : newStateOrFn;
      return newState;
    });
  }, [present]);

  const undo = useCallback(() => {
    if (past.length === 0) return;

    isUndoingRef.current = true;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);

    setPast(newPast);
    setFuture(prev => [present, ...prev]);
    setPresent(previous);

    // Reset flag after state update
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 0);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;

    isRedoingRef.current = true;
    const next = future[0];
    const newFuture = future.slice(1);

    setPast(prev => [...prev, present]);
    setFuture(newFuture);
    setPresent(next);

    // Reset flag after state update
    setTimeout(() => {
      isRedoingRef.current = false;
    }, 0);
  }, [future, present]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  // Update present when initialState changes externally (e.g., on load)
  useEffect(() => {
    if (!isUndoingRef.current && !isRedoingRef.current) {
      setPresent(initialState);
      clearHistory();
    }
  }, [initialState, clearHistory]);

  return {
    projectState: present,
    setProjectState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    clearHistory,
  };
}

