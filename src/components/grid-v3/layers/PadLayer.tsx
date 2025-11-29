import React, { memo } from 'react';
import { PadActivation, GridGeometry, GridTheme } from '../types';

interface PadLayerProps {
    pads: PadActivation[];
    variant: 'solid' | 'ghost';
    geometry: GridGeometry;
    theme: GridTheme;
    onPadClick?: (id: string, row: number, col: number) => void;
    onPadHover?: (id: string | null) => void;
}

export const PadLayer = memo(({ pads, variant, geometry, theme, onPadClick, onPadHover }: PadLayerProps) => {
    const { padSize } = geometry;
    const { padActiveColor, padGhostColor, handColors, fingerColors } = theme;

    // Filter pads based on variant
    // If variant is 'ghost', we want pads that are explicitly 'ghost' or 'next'
    // If variant is 'solid', we want pads that are 'active', 'current', or 'shared'
    const visiblePads = pads.filter(pad => {
        if (variant === 'ghost') {
            return pad.state === 'ghost' || (pad.isNext && !pad.isShared);
        } else {
            return pad.state === 'active' || pad.state === 'shared' || pad.isCurrent || pad.isShared;
        }
    });

    return (
        <g className={`pad-layer-${variant}`}>
            {visiblePads.map(pad => {
                const { x, y } = geometry.getPadCenter(pad.row, pad.col);
                const xPos = x - padSize / 2;
                const yPos = y - padSize / 2;

                // Determine color
                let fillColor = variant === 'ghost' ? padGhostColor : padActiveColor;
                let strokeColor = 'none';
                let strokeWidth = 0;
                let opacity = variant === 'ghost' ? 0.4 : 1.0;

                // Override with hand/finger colors if present
                if (pad.hand) {
                    const handColor = pad.hand === 'left' ? handColors.left : handColors.right;
                    if (variant === 'solid') {
                        fillColor = pad.color || handColor; // Use specific color if provided, else hand color
                        if (pad.finger) {
                            // Could refine this to use specific finger color from theme
                            const specificFingerColor = pad.hand === 'left'
                                ? fingerColors.left[pad.finger]
                                : fingerColors.right[pad.finger];
                            if (specificFingerColor) fillColor = specificFingerColor;
                        }
                    } else {
                        // Ghost pads usually just outlined or tinted
                        strokeColor = handColor;
                        strokeWidth = 2;
                        fillColor = 'transparent'; // Or semi-transparent hand color
                    }
                }

                // Shared pad styling
                if (pad.state === 'shared' || pad.isShared) {
                    strokeColor = '#FFFFFF'; // Highlight shared
                    strokeWidth = 3;
                }

                // Ghost pads should not be interactive
                const isGhost = variant === 'ghost' || pad.state === 'ghost';
                const pointerEvents = isGhost ? 'none' : 'auto';

                return (
                    <g
                        key={`pad-${pad.id}`}
                        data-shared={pad.isShared || pad.state === 'shared' ? 'true' : undefined}
                        onClick={isGhost ? undefined : () => onPadClick?.(pad.id, pad.row, pad.col)}
                        onMouseEnter={isGhost ? undefined : () => onPadHover?.(pad.id)}
                        onMouseLeave={isGhost ? undefined : () => onPadHover?.(null)}
                        style={{ 
                            cursor: isGhost ? 'default' : (onPadClick ? 'pointer' : 'default'),
                            pointerEvents,
                        }}
                    >
                        <rect
                            x={xPos}
                            y={yPos}
                            width={padSize}
                            height={padSize}
                            rx={4}
                            ry={4}
                            fill={fillColor}
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            opacity={opacity}
                        />

                        {/* Labels (only for solid layer usually, or if explicitly requested) */}
                        {variant === 'solid' && (
                            <>
                                {pad.label && (
                                    <text
                                        x={x}
                                        y={y}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fill="white"
                                        fontSize={10}
                                        fontWeight="bold"
                                        pointerEvents="none"
                                    >
                                        {pad.label}
                                    </text>
                                )}
                                {pad.subLabel && (
                                    <text
                                        x={x + padSize / 2 - 2}
                                        y={y - padSize / 2 + 8}
                                        textAnchor="end"
                                        dominantBaseline="auto"
                                        fill="rgba(255,255,255,0.8)"
                                        fontSize={8}
                                        pointerEvents="none"
                                    >
                                        {pad.subLabel}
                                    </text>
                                )}
                            </>
                        )}
                    </g>
                );
            })}
        </g>
    );
});

PadLayer.displayName = 'PadLayer';
