/**
 * Event Analysis Type Definitions
 * 
 * These types extend the core engine types to support detailed event-by-event
 * and transition analysis for the Onion Skin visualization feature.
 * 
 * PRD Mapping:
 * - Event → AnalyzedEvent (grouped moment containing multiple simultaneous notes)
 * - Transition → Transition (links two consecutive events with movement metrics)
 * - FingerMove → FingerMove (represents a single finger movement between events)
 * - OnionSkinModel → OnionSkinModel (complete context for onion skin visualization)
 */

import type { EngineDebugEvent } from '../engine/core';
import type { FingerType, HandSide } from '../engine/models';

/**
 * Pad key format: "row,col" string representing a Pad position on the 8x8 grid.
 * Example: "0,0" = bottom-left pad, "7,7" = top-right pad.
 */
export type PadKey = string;

/**
 * Hand type for event analysis (excludes 'Unplayable' since transitions only occur between playable events).
 */
export type HandType = 'left' | 'right';

/**
 * Represents a single note within a grouped event (moment).
 * 
 * Each note in a simultaneous event has its own debug event data and pad position.
 */
export interface EventNote {
  /** The original engine debug event for this note */
  debugEvent: EngineDebugEvent;
  /** Pad key ("row,col" format) where this note is played */
  pad: PadKey;
}

/**
 * Transition metrics between two consecutive events.
 * 
 * These metrics quantify the difficulty and characteristics of moving from one event to the next.
 * Used for heatmap visualization and difficulty scoring.
 */
export interface TransitionMetrics {
  /** Time delta between events in milliseconds */
  timeDeltaMs: number;
  
  /** Euclidean grid distance between the two pad positions (in grid cells) */
  gridDistance: number;
  
  /** Whether the transition requires switching hands (left ↔ right) */
  handSwitch: boolean;
  
  /** Whether the transition requires changing fingers (same hand, different finger) */
  fingerChange: boolean;
  
  /** Speed pressure metric: higher values indicate faster required movement (distance / time) */
  speedPressure: number;
  
  /** Anatomical stretch score: measures hand span expansion/contraction (0-1, higher = more stretch) */
  anatomicalStretchScore: number;
  
  /** Composite difficulty score: normalized 0-1 value combining all transition factors (for heatmaps) */
  compositeDifficultyScore: number;
}

/**
 * A polyphonic moment in time: all notes that share the same timestamp.
 * 
 * Represents a grouped event where multiple pads may be active simultaneously.
 * This is the primary unit for event analysis - one AnalyzedEvent = one moment in time.
 */
export interface AnalyzedEvent {
  /** 0-based index in the event sequence */
  eventIndex: number;
  
  /** startTime of this moment (in seconds) */
  timestamp: number;
  
  /** All notes active at this time */
  notes: EventNote[];
  
  /** Convenience: unique pad IDs for this event */
  pads: PadKey[];
  
  /** Optional per-event metrics */
  eventMetrics?: {
    /** Number of simultaneous notes (polyphony) */
    polyphony: number;
    /** Horizontal spread of active pads (optional) */
    spreadX?: number;
    /** Vertical spread of active pads (optional) */
    spreadY?: number;
    /** Anatomical stretch score for this event (0-1, higher = more stretch required) */
    anatomicalStretchScore?: number;
    /** Composite difficulty score combining cost, stretch, speed, fatigue (0-1, normalized for heatmaps) */
    compositeDifficultyScore?: number;
  };
}

/**
 * Transition between two consecutive analyzed events.
 * 
 * Represents the movement from one event to the next, including all transition metrics.
 * Used for analyzing patterns, identifying difficult sequences, and generating visualizations.
 */
export interface Transition {
  /** Index of the source event in the debugEvents array */
  fromIndex: number;
  
  /** Index of the target event in the debugEvents array (usually fromIndex + 1) */
  toIndex: number;
  
  /** Source analyzed event */
  fromEvent: AnalyzedEvent;
  
  /** Target analyzed event */
  toEvent: AnalyzedEvent;
  
  /** Transition metrics quantifying the difficulty of this movement */
  metrics: TransitionMetrics;
}

/**
 * Finger movement between two events.
 * 
 * Represents a single finger's movement (or lack thereof) during a transition.
 * Used for generating vector arrows in the onion skin visualization.
 */
export interface FingerMove {
  /** Finger type making the movement */
  finger: FingerType;
  
  /** Hand side (left or right) */
  hand: HandType;
  
  /** Source pad key ("row,col" format), or null if finger was not placed before */
  fromPad: PadKey | null;
  
  /** Target pad key ("row,col" format), or null if finger is not placed after */
  toPad: PadKey | null;
  
  /** Whether this finger is holding the same pad (no movement) */
  isHold: boolean;
  
  /** Whether this movement is biomechanically impossible (exceeds max reach) */
  isImpossible?: boolean;
  
  /** Raw Euclidean distance in grid cells (if movement occurred) */
  rawDistance?: number;
  
  /** Anatomical stretch score for this specific finger movement (0-1) */
  anatomicalStretchScore?: number;
}

/**
 * Onion skin model for a focused event.
 * 
 * Contains all context needed to render the onion skin visualization:
 * - Current event (N) - solid pads
 * - Previous event (N-1) - ghost pads
 * - Next event (N+1) - ghost pads
 * - Finger movements as vector arrows
 * 
 * This model is built by the onionSkinBuilder and consumed by the OnionSkinGrid component.
 */
export interface OnionSkinModel {
  /** Index of the currently focused event in the debugEvents array */
  currentEventIndex: number;
  
  /** The currently focused analyzed event (rendered as solid pads) */
  currentEvent: AnalyzedEvent;
  
  /** Previous analyzed event (rendered as ghost pads), or null if this is the first event */
  previousEvent?: AnalyzedEvent | null;
  
  /** Next analyzed event (rendered as ghost pads), or null if this is the last event */
  nextEvent?: AnalyzedEvent | null;
  
  /** Pad keys that are active in both current and next events (shared pads) */
  sharedPads: PadKey[];
  
  /** Pad keys that are active only in the current event (not in next) */
  currentOnlyPads: PadKey[];
  
  /** Pad keys that are active only in the next event (not in current) */
  nextOnlyPads: PadKey[];
  
  /** Finger movements between current and next events (for vector arrow visualization) */
  fingerMoves: FingerMove[];
}

