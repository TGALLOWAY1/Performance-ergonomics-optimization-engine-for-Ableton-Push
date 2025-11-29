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
  
  // Use a ref to access current `present` value without adding it as a dependency
  // This prevents setProjectState from being recreated on every state change
  const presentRef = useRef(present);
  presentRef.current = present;

  // STABLE callback: no dependencies that change frequently
  const setProjectState = useCallback((newStateOrFn: ProjectState | ((prev: ProjectState) => ProjectState), skipHistory = false) => {
    if (skipHistory || isUndoingRef.current || isRedoingRef.current) {
      setPresent(prev => {
        const newState = typeof newStateOrFn === 'function' ? (newStateOrFn as (prev: ProjectState) => ProjectState)(prev) : newStateOrFn;
        return newState;
      });
      return;
    }

    // Add current state to past (use ref to get current value)
    const currentPresent = presentRef.current;
    setPast(prevPast => {
      const newPast = [...prevPast, currentPresent];
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
  }, []); // Empty dependency array - callback is now stable

  const undo = useCallback(() => {
    setPast(prevPast => {
      if (prevPast.length === 0) return prevPast;
      
      isUndoingRef.current = true;
      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, -1);
      
      // Use the ref to get current present value
      const currentPresent = presentRef.current;
      setFuture(prevFuture => [currentPresent, ...prevFuture]);
      setPresent(previous);
      
      // Reset flag after state update
      setTimeout(() => {
        isUndoingRef.current = false;
      }, 0);
      
      return newPast;
    });
  }, []); // Stable callback

  const redo = useCallback(() => {
    setFuture(prevFuture => {
      if (prevFuture.length === 0) return prevFuture;
      
      isRedoingRef.current = true;
      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);
      
      // Use the ref to get current present value
      const currentPresent = presentRef.current;
      setPast(prevPast => [...prevPast, currentPresent]);
      setPresent(next);
      
      // Reset flag after state update
      setTimeout(() => {
        isRedoingRef.current = false;
      }, 0);
      
      return newFuture;
    });
  }, []); // Stable callback

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

