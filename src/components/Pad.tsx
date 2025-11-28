import React from 'react';
import { FingerType } from '../engine/models';

interface PadProps {
    row: number;
    col: number;
    isActive: boolean;
    isGhost?: boolean;
    finger?: FingerType; // 'thumb', 'index', etc.
    hand?: 'left' | 'right';
    label?: string;
    onClick?: () => void;
    className?: string;
}

// Map finger types to CSS variable indices
const FINGER_MAP: Record<string, number> = {
    thumb: 1,
    index: 2,
    middle: 3,
    ring: 4,
    pinky: 5
};

export const Pad: React.FC<PadProps> = ({
    row,
    col,
    isActive,
    isGhost = false,
    finger,
    hand,
    label,
    onClick,
    className = ''
}) => {
    // Determine the CSS variable for the finger color
    let fingerColorVar = '--text-secondary'; // Default fallback

    if (finger && hand) {
        const handPrefix = hand === 'left' ? 'L' : 'R';
        const fingerIndex = FINGER_MAP[finger] || 1;
        fingerColorVar = `var(--finger-${handPrefix}${fingerIndex})`;
    }

    // Dynamic styles
    const style: React.CSSProperties = {
        '--current-finger-color': fingerColorVar,
        transition: 'all 0.1s ease-out',
    } as React.CSSProperties;

    // Base classes
    const baseClasses = `
    relative flex items-center justify-center 
    rounded-[var(--radius-md)] 
    border border-[var(--border-subtle)]
    bg-[var(--bg-panel)]
    cursor-pointer select-none
    hover:brightness-110
  `;

    // Active state classes
    const activeClasses = isActive
        ? `
      bg-[var(--bg-card)] 
      border-[color:var(--current-finger-color)]
      shadow-[inset_0_0_15px_var(--current-finger-color),0_0_10px_var(--current-finger-color)]
      z-10
    `
        : '';

    // Ghost state classes (for previous/next steps)
    const ghostClasses = isGhost
        ? `opacity-30 border-dashed border-[var(--text-tertiary)]`
        : '';

    return (
        <div
            className={`${baseClasses} ${activeClasses} ${ghostClasses} ${className}`}
            style={style}
            onClick={onClick}
            data-row={row}
            data-col={col}
        >
            {/* Inner Content */}
            <div className="relative z-20 flex flex-col items-center justify-center">
                {/* Finger Icon / Label */}
                {isActive && finger && (
                    <div
                        className="w-3 h-3 rounded-full mb-1"
                        style={{ backgroundColor: fingerColorVar }}
                    />
                )}

                {/* Text Label */}
                {label && (
                    <span className={`text-[10px] font-bold ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                        {label}
                    </span>
                )}
            </div>
        </div>
    );
};
