import { Loader2Icon, OctagonXIcon } from 'lucide-react';

type PlayerDropsLoadingSpinnerProps = {
    isError?: boolean;
};
export function PlayerDropsLoadingSpinner({ isError }: PlayerDropsLoadingSpinnerProps) {
    if (isError) {
        return (
            <div className="text-destructive-inline flex h-full min-h-28 flex-col items-center justify-center gap-2">
                <OctagonXIcon className="size-16 opacity-75" />
                <span>Error loading data.</span>
            </div>
        );
    } else {
        return (
            <div className="text-muted-foreground flex h-full min-h-28 items-center justify-center">
                <Loader2Icon className="size-16 animate-spin opacity-75" />
            </div>
        );
    }
}

type PlayerDropsMessageProps = {
    message: string;
};
export function PlayerDropsMessage({ message }: PlayerDropsMessageProps) {
    return (
        <div className="text-muted-foreground/75 flex h-full min-h-28 items-center justify-center px-4 py-6 text-xl tracking-wider">
            {message}
        </div>
    );
}
