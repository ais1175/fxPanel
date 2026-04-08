import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export default function BreakpointDebugger() {
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsOverflowing(document.documentElement.scrollWidth > window.innerWidth);
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <div className="top-navbarvh pointer-events-none fixed z-9999 flex w-screen flex-row justify-center select-none">
            <div
                className={cn(
                    'flex w-fit flex-row flex-wrap items-center justify-center gap-1 p-2 uppercase',
                    isOverflowing ? 'bg-destructive-hint' : 'bg-zinc-900/75',
                )}
            >
                <div className={cn(isOverflowing ? 'block' : 'hidden', 'w-full border-b-2 border-red-500 text-center')}>
                    Overflowing!
                </div>
                <h1 className="xs:bg-green-500 bg-red-500 px-1">xs</h1>
                <h1 className="bg-red-500 px-1 sm:bg-green-500">sm</h1>
                <h1 className="bg-red-500 px-1 md:bg-green-500">md</h1>
                <h1 className="bg-red-500 px-1 lg:bg-green-500">lg</h1>
                <h1 className="bg-red-500 px-1 xl:bg-green-500">xl</h1>
                <h1 className="bg-red-500 px-1 2xl:bg-green-500">2xl</h1>
            </div>
        </div>
    );
}
