import React, { memo } from 'react';
import { OverlayAnnotation, GridGeometry } from '../types';

interface OverlayLayerProps {
    overlays: OverlayAnnotation[];
    geometry: GridGeometry;
}

export const OverlayLayer = memo(({ overlays, geometry }: OverlayLayerProps) => {
    const { padSize } = geometry;

    return (
        <div className="overlay-layer absolute inset-0 pointer-events-none">
            {overlays.map(overlay => {
                const { x, y } = geometry.getPadCenter(overlay.row, overlay.col);

                // Default positioning logic (can be enhanced based on overlay.position)
                // Center the content on the pad
                const style: React.CSSProperties = {
                    position: 'absolute',
                    left: x,
                    top: y,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'auto', // Allow interaction with overlay content
                    zIndex: 10,
                };

                return (
                    <div key={overlay.id} style={style}>
                        {overlay.content}
                    </div>
                );
            })}
        </div>
    );
});

OverlayLayer.displayName = 'OverlayLayer';
