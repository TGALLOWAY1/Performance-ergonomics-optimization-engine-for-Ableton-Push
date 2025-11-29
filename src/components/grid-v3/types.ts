import { FingerType, HandSide } from '../../engine/models';

/**
 * Unique identifier for a Pad (format: "row,col")
 */
export type PadId = string;

/**
 * Finger identifier (1-5)
 * 1=Thumb, 2=Index, 3=Middle, 4=Ring, 5=Pinky
 */
export type FingerId = 1 | 2 | 3 | 4 | 5;

/**
 * Hand identifier
 */
export type HandId = HandSide;

/**
 * Declarative model for a single Pad's state in the grid.
 * Decoupled from engine logic - purely for visualization.
 */
export interface PadActivation {
    id: PadId;
    row: number;
    col: number;

    /** Is this pad the current event in a sequence? */
    isCurrent?: boolean;
    /** Is this pad the next event in a sequence (ghost)? */
    isNext?: boolean;
    /** Is this pad shared between current and next events? */
    isShared?: boolean;

    /** Assigned finger (if any) */
    finger?: FingerId;
    /** Assigned hand (if any) */
    hand?: HandId;

    /** Visual state of the pad */
    state?: 'idle' | 'active' | 'ghost' | 'shared';

    /** Primary label (e.g., Note Name, Sound Name) */
    label?: string;
    /** Secondary label (e.g., Finger Name) */
    subLabel?: string;

    /** Intensity/Velocity/Difficulty (0.0 to 1.0) */
    intensity?: number;

    /** Color override (hex) */
    color?: string;

    /** Difficulty rating for heatmap */
    difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Unplayable';
}

/**
 * Vector primitive for drawing lines/arrows between pads.
 * Used for onion skinning and reachability visualization.
 */
export interface VectorPrimitive {
    id: string;
    type: 'arrow' | 'arc' | 'line';

    from: { row: number; col: number };
    to: { row: number; col: number };

    color?: string;
    width?: number;
    opacity?: number;

    /** Anatomical stretch weighting (affects visual style, e.g., dashed if high tension) */
    difficulty?: number;
}

/**
 * Overlay annotation for tooltips, badges, etc.
 */
export interface OverlayAnnotation {
    id: string;
    row: number;
    col: number;
    content: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

/**
 * Grid Geometry Model
 * Centralizes coordinate math for the grid.
 */
export interface GridGeometry {
    padSize: number;
    padGap: number;
    origin: 'bottom-left' | 'top-left';
    width: number;
    height: number;

    /** Calculate center x/y for a given row/col */
    getPadCenter: (row: number, col: number) => { x: number; y: number };
}

/**
 * Grid Visualization Modes
 */
export type GridMode = 'snapshot' | 'onion-skin' | 'playback' | 'editor' | 'heatmap';

/**
 * Theme configuration for the grid
 */
export interface GridTheme {
    backgroundColor: string;
    gridLineColor: string;
    padIdleColor: string;
    padActiveColor: string;
    padGhostColor: string;
    handColors: {
        left: string;
        right: string;
    };
    fingerColors: {
        left: Record<FingerId, string>;
        right: Record<FingerId, string>;
    };
}

/**
 * Unified Props for the GridVisContainer
 */
export interface GridVisProps {
    rows?: number;
    cols?: number;
    mode: GridMode;

    pads: PadActivation[];
    vectors?: VectorPrimitive[];
    overlays?: OverlayAnnotation[];

    geometry?: Partial<GridGeometry>;
    theme?: Partial<GridTheme>;

    onPadClick?: (id: PadId, row: number, col: number) => void;
    onPadRightClick?: (id: PadId, row: number, col: number) => void;
    onPadHover?: (id: PadId | null) => void;

    className?: string;
    style?: React.CSSProperties;
}
