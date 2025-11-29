import React, { memo } from 'react';
import { VectorPrimitive, GridGeometry } from '../types';

interface VectorLayerProps {
    vectors: VectorPrimitive[];
    geometry: GridGeometry;
}

export const VectorLayer = memo(({ vectors, geometry }: VectorLayerProps) => {
    // Helper to calculate Bezier control point for a nice arc
    const getControlPoint = (x1: number, y1: number, x2: number, y2: number) => {
        // Midpoint
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;

        // Vector
        const dx = x2 - x1;
        const dy = y2 - y1;

        // Perpendicular vector (rotated 90 degrees)
        // Adjust magnitude based on distance to create a nice curve
        const dist = Math.sqrt(dx * dx + dy * dy);
        const offset = dist * 0.2; // Curve amount

        return {
            x: mx - dy * 0.2, // Simple perpendicular offset
            y: my + dx * 0.2
        };
    };

    return (
        <g className="vector-layer">
            <defs>
                <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#FFFFFF" opacity="0.6" />
                </marker>
            </defs>

            {vectors.map(vector => {
                const start = geometry.getPadCenter(vector.from.row, vector.from.col);
                const end = geometry.getPadCenter(vector.to.row, vector.to.col);

                const cp = getControlPoint(start.x, start.y, end.x, end.y);

                // Quadratic Bezier: M start Q cp end
                const d = `M ${start.x} ${start.y} Q ${cp.x} ${cp.y} ${end.x} ${end.y}`;

                return (
                    <path
                        key={vector.id}
                        d={d}
                        stroke={vector.color || '#FFFFFF'}
                        strokeWidth={vector.width || 2}
                        strokeOpacity={vector.opacity || 0.6}
                        fill="none"
                        markerEnd="url(#arrowhead)"
                        style={{ pointerEvents: 'none' }}
                    />
                );
            })}
        </g>
    );
});

VectorLayer.displayName = 'VectorLayer';
