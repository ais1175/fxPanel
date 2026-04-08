import { useEffect, useState } from 'react';

const getViewportMetrics = () => {
    if (typeof window === 'undefined') return { effectiveWidth: 0, hasScaledViewportMismatch: false };

    const innerWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const physicalWidth = Math.max(
        innerWidth,
        Math.round(innerWidth * devicePixelRatio),
        window.outerWidth || 0,
        window.screen?.availWidth || 0,
        window.screen?.width || 0,
    );

    const hasScaledViewportMismatch = !window.txIsMobile && innerWidth < 640 && physicalWidth >= 1280;
    const effectiveWidth = hasScaledViewportMismatch ? physicalWidth : innerWidth;

    return {
        effectiveWidth,
        hasScaledViewportMismatch,
    };
};

const getBreakpoints = () => {
    const { effectiveWidth, hasScaledViewportMismatch } = getViewportMetrics();

    return {
        effectiveWidth,
        hasScaledViewportMismatch,
        isSm: effectiveWidth >= 640,
        isLg: effectiveWidth >= 1024,
        isXl: effectiveWidth >= 1280,
        is2xl: effectiveWidth >= 1400,
    };
};

export const useShellBreakpoints = () => {
    const [breakpoints, setBreakpoints] = useState(getBreakpoints);

    useEffect(() => {
        const updateBreakpoints = () => setBreakpoints(getBreakpoints());

        updateBreakpoints();
        window.addEventListener('resize', updateBreakpoints);

        return () => {
            window.removeEventListener('resize', updateBreakpoints);
        };
    }, []);

    return breakpoints;
};
