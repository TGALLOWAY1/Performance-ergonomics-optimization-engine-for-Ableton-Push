import React, { memo } from 'react';
import { GridGeometry, GridTheme } from '../types';

interface BaseGridLayerProps {
    rows: number;
    cols: number;
    geometry: GridGeometry;
    theme: GridTheme;
}

export const BaseGridLayer = memo(({ rows, cols, geometry, theme }: BaseGridLayerProps) => {
    const { padSize, padGap } = geometry;
    const { padIdleColor } = theme;

    const gridItems = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const { x, y } = geometry.getPadCenter(r, c);
            // Calculate top-left from center
            const xPos = x - padSize / 2;
            const yPos = y - padSize / 2;

            gridItems.push(
                <rect
                    key={`base-${r}-${c}`}
                    x={xPos}
                    y={yPos}
                    width={padSize}
                    height={padSize}
                    rx={4} // Rounded corners
                    ry={4}
                    fill={padIdleColor}
                    stroke="none"
                />
            );
        }
    }

    return (
        <g className="base-grid-layer">
            {gridItems}
        </g>
    );
});

BaseGridLayer.displayName = 'BaseGridLayer';
