/**
 * Onion Skin Grid Visualization Component
 * 
 * Renders an onion skin visualization using the existing GridVisContainer,
 * showing current event (N), previous event (N-1), and next event (N+1)
 * with finger movement vectors.
 * 
 * PRD Visual Rules:
 * - Current pads (N): solid, 100% opacity, bright halo
 * - Next pads (N+1): ghosted, 20-30% opacity, thin border, lower saturation
 * - Shared pads: solid with double halo or pulse effect
 * - Vectors: Bezier curves with hand-based colors
 * - Impossible moves: red ring / warning styling
 */

import React, { useMemo, memo, useCallback } from 'react';
import type { OnionSkinModel, FingerMove } from '../../types/eventAnalysis';
import type { FingerType } from '../../engine/models';
import { GridVisContainer } from '../grid-v3/GridVisContainer';
import type { PadActivation, VectorPrimitive, GridTheme } from '../grid-v3/types';
import { parseCellKey } from '../../types/layout';

/**
 * Props for OnionSkinGrid component
 */
export interface OnionSkinGridProps {
  /** Onion skin model containing current, previous, next events and finger moves */
  model: OnionSkinModel;
  /** Callback when a pad is hovered (receives pad key "row,col") */
  onPadHover?: (padKey: string) => void;
  /** Callback when a vector is hovered (receives the FingerMove) */
  onVectorHover?: (move: FingerMove) => void;
  /** Optional custom className */
  className?: string;
  /** Optional custom style */
  style?: React.CSSProperties;
}

/**
 * Maps FingerType to FingerId (1-5) for visualization
 */
function mapFingerTypeToId(finger: FingerType): 1 | 2 | 3 | 4 | 5 {
  switch (finger) {
    case 'thumb': return 1;
    case 'index': return 2;
    case 'middle': return 3;
    case 'ring': return 4;
    case 'pinky': return 5;
    default: return 2;
  }
}

/**
 * Formats finger indicator for a single pad (e.g., "L2", "R3")
 * Returns the finger indicator string or undefined if no valid finger
 */
function formatFingerIndicator(hand: 'left' | 'right' | 'Unplayable' | undefined, finger: FingerType | null | undefined): string | undefined {
  if (!hand || hand === 'Unplayable' || !finger) {
    return undefined;
  }
  
  const fingerNum = mapFingerTypeToId(finger);
  const handPrefix = hand === 'left' ? 'L' : 'R';
  return `${handPrefix}${fingerNum}`;
}

/**
 * Gets hand-based color for pads and vectors
 * Left hand: cyan/blue, Right hand: orange/peach
 */
function getHandColor(hand: 'left' | 'right', variant: 'solid' | 'ghost'): string {
  if (hand === 'left') {
    return variant === 'solid' ? '#00FFFF' : 'rgba(0, 255, 255, 0.25)'; // Cyan / pale cyan ghost
  } else {
    return variant === 'solid' ? '#FF8800' : 'rgba(255, 200, 150, 0.25)'; // Orange / pale peach ghost
  }
}

/**
 * Converts OnionSkinModel to PadActivation[] for GridVisContainer
 * 
 * For grouped events, creates activations for all pads in each event.
 */
function modelToPadActivations(model: OnionSkinModel): PadActivation[] {
  const activations: PadActivation[] = [];
  
  // Current event pads (solid, 100% opacity, bright)
  for (const padKey of model.currentEvent.pads) {
    const pos = parseCellKey(padKey);
    if (!pos) continue;
    
    const isShared = model.sharedPads.includes(padKey);
    
    // Find the note for this pad to get hand/finger info
    const note = model.currentEvent.notes.find((n) => n.pad === padKey);
    const hand = note && note.debugEvent.assignedHand !== 'Unplayable' 
      ? note.debugEvent.assignedHand 
      : undefined;
    const finger = note && note.debugEvent.finger 
      ? mapFingerTypeToId(note.debugEvent.finger) 
      : undefined;
    
    const currentPad: PadActivation = {
      id: padKey,
      row: pos.row,
      col: pos.col,
      isCurrent: true,
      isShared,
      state: isShared ? 'shared' : 'active',
      hand,
      finger,
      label: formatFingerIndicator(note?.debugEvent.assignedHand, note?.debugEvent.finger),
      difficulty: note?.debugEvent.difficulty,
      intensity: model.currentEvent.eventMetrics?.compositeDifficultyScore || 0,
      // Apply hand-based color
      color: hand ? getHandColor(hand, 'solid') : undefined,
    };
    activations.push(currentPad);
  }
  
  // Next event pads (ghost, 20-30% opacity, thin border)
  if (model.nextEvent) {
    for (const padKey of model.nextEvent.pads) {
      const pos = parseCellKey(padKey);
      if (!pos) continue;
      
      const isShared = model.sharedPads.includes(padKey);
      
      // Find the note for this pad to get hand/finger info
      const note = model.nextEvent.notes.find((n) => n.pad === padKey);
      const hand = note && note.debugEvent.assignedHand !== 'Unplayable' 
        ? note.debugEvent.assignedHand 
        : undefined;
      const finger = note && note.debugEvent.finger 
        ? mapFingerTypeToId(note.debugEvent.finger) 
        : undefined;
      
      const nextPad: PadActivation = {
        id: padKey,
        row: pos.row,
        col: pos.col,
        isNext: true,
        isShared,
        state: 'ghost',
        hand,
        finger,
        label: formatFingerIndicator(note?.debugEvent.assignedHand, note?.debugEvent.finger),
        difficulty: note?.debugEvent.difficulty,
        intensity: (model.nextEvent.eventMetrics?.compositeDifficultyScore || 0) * 0.3, // Lower intensity for ghost
        // Apply hand-based ghost color
        color: hand ? getHandColor(hand, 'ghost') : undefined,
      };
      activations.push(nextPad);
    }
  }
  
  // Previous event pads (ghost, very low opacity, for context)
  if (model.previousEvent) {
    for (const padKey of model.previousEvent.pads) {
      const pos = parseCellKey(padKey);
      if (!pos) continue;
      
      // Skip if this pad is already shown in current or next event
      if (model.currentEvent.pads.includes(padKey) || 
          (model.nextEvent && model.nextEvent.pads.includes(padKey))) {
        continue;
      }
      
      // Find the note for this pad to get hand/finger info
      const note = model.previousEvent.notes.find((n) => n.pad === padKey);
      const hand = note && note.debugEvent.assignedHand !== 'Unplayable' 
        ? note.debugEvent.assignedHand 
        : undefined;
      
      const prevPad: PadActivation = {
        id: padKey,
        row: pos.row,
        col: pos.col,
        state: 'ghost',
        hand,
        // Very low opacity for previous event (just context)
        intensity: 0.1,
        color: hand ? getHandColor(hand, 'ghost') : undefined,
      };
      activations.push(prevPad);
    }
  }
  
  return activations;
}

/**
 * Converts FingerMove[] to VectorPrimitive[] for GridVisContainer
 * 
 * Note: Vector hover is not yet supported as VectorLayer has pointerEvents: 'none'.
 * This would require enhancing VectorLayer to support hover interactions.
 */
function fingerMovesToVectors(
  fingerMoves: FingerMove[]
): VectorPrimitive[] {
  const vectors: VectorPrimitive[] = [];
  
  for (const move of fingerMoves) {
    if (move.fromPad === null || move.toPad === null || move.isHold) {
      continue;
    }
    
    const fromPos = parseCellKey(move.fromPad);
    const toPos = parseCellKey(move.toPad);
    
    if (!fromPos || !toPos) {
      continue;
    }
    
    // Determine vector color based on hand and impossibility
    let color: string;
    let opacity: number;
    let width: number;
    
    if (move.isImpossible) {
      // Red warning for impossible moves
      color = '#FF0000';
      opacity = 0.8;
      width = 3;
    } else {
      // Hand-based color
      color = getHandColor(move.hand, 'solid');
      opacity = 0.6;
      width = 2;
    }
    
    vectors.push({
      id: `vec-${move.hand}-${move.finger}-${vectors.length}`,
      type: 'arrow' as const,
      from: { row: fromPos.row, col: fromPos.col },
      to: { row: toPos.row, col: toPos.col },
      color,
      opacity,
      width,
      difficulty: move.anatomicalStretchScore,
    });
  }
  
  return vectors;
}

/**
 * Creates custom theme for onion skin visualization
 * Applies PRD visual rules: cyan/blue for left, orange/peach for right
 */
function createOnionSkinTheme(): Partial<GridTheme> {
  return {
    backgroundColor: '#121212',
    gridLineColor: '#333333',
    padIdleColor: '#1A1A1A',
    padActiveColor: '#333333',
    padGhostColor: 'rgba(255, 255, 255, 0.1)',
    handColors: {
      left: '#00FFFF', // Cyan
      right: '#FF8800', // Orange
    },
    fingerColors: {
      left: {
        1: '#00CCFF', // Thumb - lighter cyan
        2: '#00FFFF', // Index - cyan
        3: '#00AAFF', // Middle - medium cyan
        4: '#0088FF', // Ring - darker cyan
        5: '#0066FF', // Pinky - darkest cyan
      },
      right: {
        1: '#FFAA00', // Thumb - lighter orange
        2: '#FF8800', // Index - orange
        3: '#FF6600', // Middle - medium orange
        4: '#FF4400', // Ring - darker orange
        5: '#FF2200', // Pinky - darkest orange
      },
    },
  };
}

/**
 * Onion Skin Grid Component
 * 
 * Renders the onion skin visualization using GridVisContainer with:
 * - Current event pads (solid, bright)
 * - Next event pads (ghost, 20-30% opacity)
 * - Previous event pads (ghost, very low opacity)
 * - Finger movement vectors (Bezier curves)
 * - Hand-based color coding (cyan/blue for left, orange/peach for right)
 * - Warning styling for impossible moves (red)
 */
export const OnionSkinGrid: React.FC<OnionSkinGridProps> = memo(({
  model,
  onPadHover,
  onVectorHover,
  className = '',
  style = {},
}) => {
  // Convert model to pad activations (memoized)
  const pads = useMemo(() => modelToPadActivations(model), [
    model.currentEvent,
    model.nextEvent,
    model.previousEvent,
    model.sharedPads,
  ]);
  
  // Convert finger moves to vectors (memoized)
  const vectors = useMemo(() => fingerMovesToVectors(model.fingerMoves), [
    model.fingerMoves,
  ]);
  
  // Create custom theme (memoized)
  const theme = useMemo(() => createOnionSkinTheme(), []);
  
  // Handle pad hover - map back to PadKey
  const handlePadHover = useCallback((id: string | null) => {
    if (onPadHover && id) {
      onPadHover(id);
    }
  }, [onPadHover]);
  
  return (
    <div className={`onion-skin-grid ${className}`} style={style}>
      <GridVisContainer
        rows={8}
        cols={8}
        mode="onion-skin"
        pads={pads}
        vectors={vectors}
        theme={theme}
        onPadHover={handlePadHover}
        className={className}
        style={style}
      />
      
      {/* CSS for visual polish: shared pad pulse, z-ordering, hover effects */}
      <style>{`
        /* Ensure current pads are always on top (higher z-index via SVG order) */
        .onion-skin-grid .pad-layer-solid {
          z-index: 10;
        }
        
        .onion-skin-grid .pad-layer-ghost {
          z-index: 5;
          pointer-events: none; /* Ghost pads never steal focus */
        }
        
        /* Shared pad pulse effect (double halo) */
        .onion-skin-grid .pad-layer-solid g[data-shared="true"] rect,
        .onion-skin-grid .pad-layer-solid rect[data-shared="true"] {
          filter: drop-shadow(0 0 4px currentColor) drop-shadow(0 0 8px currentColor);
          animation: pulse 2s ease-in-out infinite;
        }
        
        /* Ghost pad styling - lower opacity, thin border */
        .onion-skin-grid .pad-layer-ghost rect {
          stroke-width: 1.5;
          stroke-opacity: 0.5;
          opacity: 0.25; /* 20-30% opacity as per PRD */
        }
        
        /* Vector hover effects (when VectorLayer supports pointer events) */
        .onion-skin-grid .vector-layer path {
          transition: stroke-width 0.2s, opacity 0.2s;
        }
        
        .onion-skin-grid .vector-layer path:hover {
          stroke-width: 4;
          opacity: 1;
          cursor: pointer;
        }
        
        /* Pulse animation for shared pads */
        @keyframes pulse {
          0%, 100% { 
            opacity: 1;
            filter: drop-shadow(0 0 4px currentColor) drop-shadow(0 0 8px currentColor);
          }
          50% { 
            opacity: 0.85;
            filter: drop-shadow(0 0 6px currentColor) drop-shadow(0 0 12px currentColor);
          }
        }
      `}</style>
    </div>
  );
});

OnionSkinGrid.displayName = 'OnionSkinGrid';

