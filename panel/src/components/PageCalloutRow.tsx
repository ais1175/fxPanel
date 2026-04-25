import React, { useEffect, useState } from 'react';

const easeOutQuart = (t: number) => 1 - --t * t * t * t;
const frameDuration = 1000 / 60;

type CountUpAnimationProps = {
    countTo: number;
    duration?: number;
};

//Snippet from: https://jshakespeare.com/simple-count-up-number-animation-javascript-react/
const CountUpAnimation = ({ countTo, duration = 1250 }: CountUpAnimationProps) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let frame = 0;
        const totalFrames = Math.round(duration / frameDuration);
        const counter = setInterval(() => {
            frame++;
            const progress = easeOutQuart(frame / totalFrames);
            setCount(countTo * progress);

            if (frame === totalFrames) {
                clearInterval(counter);
            }
        }, frameDuration);
        return () => clearInterval(counter);
    }, [countTo, duration]);

    return Math.floor(count).toLocaleString('en-US');
};

function NumberLoading() {
    return <div className="bg-muted h-7 w-28 animate-pulse rounded-md" />;
}

export type PageCalloutProps = {
    label: string;
    icon: React.ReactNode;
    value: number | false;
    prefix?: string;
};

export type PageCalloutRowProps = {
    /** Up to 4 callouts. Extras are ignored; fewer renders only what's provided. */
    callouts: PageCalloutProps[];
};
export default function PageCalloutRow({ callouts }: PageCalloutRowProps) {
    if (callouts.length > 4 && process.env.NODE_ENV !== 'production') {
        console.warn(`PageCalloutRow: expected up to 4 callouts but received ${callouts.length}`);
    }

    const visibleCallouts = callouts.slice(0, 4);

    if (visibleCallouts.length === 0) {
        return (
            <div className="mb-4 rounded-xl border border-dashed border-border/60 bg-card/50 px-4 py-3 text-center text-xs text-muted-foreground md:mb-5">
                No callouts available.
            </div>
        );
    }

    return (
        <div className="xs:gap-3 mb-4 grid grid-cols-2 gap-2 md:mb-5 md:px-0 lg:grid-cols-4">
            {visibleCallouts.map((callout, i) => (
                <div key={`${callout.label}-${i}`} className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                            {callout.label}
                        </span>
                        <span className="text-muted-foreground/30 [&>svg]:size-4 hidden xs:block xs:[&>svg]:block">
                            {callout.icon}
                        </span>
                    </div>
                    {callout.value === false ? (
                        <NumberLoading />
                    ) : (
                        <div className="text-xl font-semibold tabular-nums text-foreground xs:text-2xl">
                            {callout.prefix}
                            <CountUpAnimation countTo={callout.value} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
