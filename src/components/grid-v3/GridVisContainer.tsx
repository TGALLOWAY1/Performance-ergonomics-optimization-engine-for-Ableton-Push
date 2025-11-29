import React, { useMemo } from 'react';
import { GridVisProps, GridGeometry, GridTheme } from './types';
import { BaseGridLayer } from './layers/BaseGridLayer';
import { PadLayer } from './layers/PadLayer';
import { VectorLayer } from './layers/VectorLayer';
import { OverlayLayer } from './layers/OverlayLayer';

// Default Theme
const DEFAULT_THEME: GridTheme = {
    backgroundColor: '#121212',
    gridLineColor: '#333333',
    padIdleColor: '#1A1A1A',
    padActiveColor: '#333333',
    padGhostColor: 'rgba(255, 255, 255, 0.1)',
    handColors: {
        left: '#0044FF',
        right: '#FF0000',
    },
    fingerColors: {
        left: { 1: '#0044FF', 2: '#0088FF', 3: '#00FFFF', 4: '#8800FF', 5: '#CC00FF' },
        right: { 1: '#FF0000', 2: '#FF4400', 3: '#FF8800', 4: '#FFCC00', 5: '#FFFF00' },
    },
};

export const GridVisContainer: React.FC<GridVisProps> = ({
    rows = 8,
    cols = 8,
    mode,
    pads,
    vectors = [],
    overlays = [],
    geometry: customGeometry,
    theme: customTheme,
    onPadClick,
    onPadHover,
    className = '',
    style = {},
}) => {
    // Merge theme
    const theme = useMemo(() => ({ ...DEFAULT_THEME, ...customTheme }), [customTheme]);

    // Calculate Geometry
    const geometry = useMemo((): GridGeometry => {
        if (customGeometry && customGeometry.getPadCenter && customGeometry.width && customGeometry.height) {
            return customGeometry as GridGeometry;
        }

        const padSize = customGeometry?.padSize || 60;
        const padGap = customGeometry?.padGap || 4;
        const origin = customGeometry?.origin || 'bottom-left';

        const width = cols * padSize + (cols + 1) * padGap;
        const height = rows * padSize + (rows + 1) * padGap;

        const getPadCenter = (row: number, col: number) => {
            // 0,0 is bottom-left by default for Push grid
            // SVG 0,0 is top-left

            const x = padGap + col * (padSize + padGap) + padSize / 2;

            let y;
            if (origin === 'bottom-left') {
                // Invert row for SVG y-axis
                y = height - (padGap + row * (padSize + padGap) + padSize / 2);
            } else {
                y = padGap + row * (padSize + padGap) + padSize / 2;
            }

            return { x, y };
        };

        return {
            padSize,
            padGap,
            origin,
            width,
            height,
            getPadCenter,
        };
    }, [rows, cols, customGeometry]);

    return (
        <div
            className={`grid-vis-container relative ${className}`}
            style={{
                width: '100%',
                height: '100%',
                aspectRatio: `${geometry.width}/${geometry.height}`,
                ...style
            }}
        >
            <svg
                viewBox={`0 0 ${geometry.width} ${geometry.height}`}
                className="w-full h-full block"
                style={{ backgroundColor: theme.backgroundColor }}
            >
                {/* Layer 1: Base Grid (Static) */}
                <BaseGridLayer
                    rows={rows}
                    cols={cols}
                    geometry={geometry}
                    theme={theme}
                />

                {/* Layer 2: Ghost Pads (Onion Skin N+1) */}
                <PadLayer
                    pads={pads}
                    variant="ghost"
                    geometry={geometry}
                    theme={theme}
                />

                {/* Layer 3: Vectors (Movement) */}
                <VectorLayer
                    vectors={vectors}
                    geometry={geometry}
                />

                {/* Layer 4: Solid Pads (Current Event N) */}
                <PadLayer
                    pads={pads}
                    variant="solid"
                    geometry={geometry}
                    theme={theme}
                    onPadClick={onPadClick}
                    onPadHover={onPadHover}
                />
            </svg>

            {/* Layer 5: Overlays (HTML on top) */}
            <OverlayLayer
                overlays={overlays}
                geometry={geometry}
            />
        </div>
    );
};
