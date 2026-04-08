import { useEffect, useRef } from 'react';
import { useIsMenuVisible } from '../state/visibility.state';

const seq = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
];

export const useListenerForSomething = () => {
    const IsMenuVisible = useIsMenuVisible();
    const currentIdxRef = useRef(0);

    useEffect(() => {
        if (!IsMenuVisible) return;

        const handler = (e: KeyboardEvent) => {
            if (e.key === seq[currentIdxRef.current]) {
                currentIdxRef.current++;
                if (currentIdxRef.current >= seq.length) {
                    // ee after seq?
                    console.log('seq entered successfully');
                    currentIdxRef.current = 0;
                }
            } else {
                currentIdxRef.current = 0;
            }
        };

        window.addEventListener('keydown', handler);
        return () => {
            window.removeEventListener('keydown', handler);
            currentIdxRef.current = 0;
        };
    }, [IsMenuVisible]);
};
