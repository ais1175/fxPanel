import { tsToLocaleDateString, tsToLocaleDateTimeString } from '@/lib/dateTime';
import { txToast } from './txToaster';
import { useClockDrift } from '@/hooks/status';

const clockSkewTolerance = 5 * 60; //5 minutes

type Props = {
    tsObject: number;
    tsFetch?: number;
    serverTime?: number;
    className?: string;
    isDateOnly?: boolean;
    dateStyle?: 'full' | 'long' | 'medium' | 'short';
    timeStyle?: 'full' | 'long' | 'medium' | 'short';
};

export default function DateTimeCorrected({
    tsObject,
    tsFetch,
    serverTime,
    className,
    isDateOnly,
    dateStyle,
    timeStyle,
}: Props) {
    const globalDrift = useClockDrift();

    // Use per-response drift if provided, otherwise fall back to global drift
    const serverClockDrift = tsFetch !== undefined && serverTime !== undefined ? serverTime - tsFetch : globalDrift;
    const correctedTime = tsObject - serverClockDrift;

    const clockDriftBtnHandler = () => {
        txToast.warning(
            `This means that the server clock is ${Math.abs(serverClockDrift)} seconds ${serverClockDrift > 0 ? 'ahead' : 'behind'} your computer time. Make sure both your computer and the server have their clocks synchronized.`,
        );
    };
    const displayTime = isDateOnly
        ? tsToLocaleDateString(correctedTime, dateStyle ?? 'medium')
        : tsToLocaleDateTimeString(correctedTime, dateStyle ?? 'medium', timeStyle ?? 'short');
    return (
        <span className={className} title={tsToLocaleDateTimeString(correctedTime, 'long', 'long')}>
            {displayTime}
            {Math.abs(serverClockDrift) > clockSkewTolerance && (
                <button className="text-warning-inline ml-1" onClick={clockDriftBtnHandler}>
                    (clock drift)
                </button>
            )}
        </span>
    );
}
