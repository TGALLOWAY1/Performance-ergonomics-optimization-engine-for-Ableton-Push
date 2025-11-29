import React from 'react';

export const FingerLegend: React.FC = () => {
    const fingers = [1, 2, 3, 4, 5];

    return (
        <div className="flex items-center justify-center gap-6 px-4 py-3 mt-4">
            {/* Left Hand */}
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Left Hand</span>
                <div className="flex gap-1">
                    {fingers.map(f => (
                        <div key={`L${f}`} className="flex items-center gap-1.5" title={`Left Hand Finger ${f}`}>
                            <div
                                className="w-3 h-3 rounded-full shadow-sm"
                                style={{ backgroundColor: `var(--finger-L${f})` }}
                            />
                            <span className="text-[9px] text-[var(--text-secondary)] font-mono">L{f}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="w-px h-4 bg-[var(--border-subtle)]" />

            {/* Right Hand */}
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Right Hand</span>
                <div className="flex gap-1">
                    {fingers.map(f => (
                        <div key={`R${f}`} className="flex items-center gap-1.5" title={`Right Hand Finger ${f}`}>
                            <div
                                className="w-3 h-3 rounded-full shadow-sm"
                                style={{ backgroundColor: `var(--finger-R${f})` }}
                            />
                            <span className="text-[9px] text-[var(--text-secondary)] font-mono">R{f}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
