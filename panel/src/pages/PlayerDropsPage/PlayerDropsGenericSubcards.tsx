import { Loader2Icon, OctagonXIcon } from 'lucide-react';

type PlayerDropsLoadingSpinnerProps = {
    isError?: boolean;
};
export function PlayerDropsLoadingSpinner({ isError }: PlayerDropsLoadingSpinnerProps) {
    if (isError) {
        return (
            <div className="text-destructive-inline flex h-full min-h-24 flex-col items-center justify-center gap-2">
                <OctagonXIcon className="size-10 opacity-75" />
                <span className="text-sm">Error loading data.</span>
            </div>
        );
    } else {
        return (
            <div className="text-muted-foreground flex h-full min-h-24 items-center justify-center">
                <Loader2Icon className="size-8 animate-spin opacity-75" />
            </div>
        );
    }
}

type PlayerDropsMessageProps = {
    message: string;
};
export function PlayerDropsMessage({ message }: PlayerDropsMessageProps) {
    return (
        <div className="text-muted-foreground/60 flex h-full min-h-24 items-center justify-center px-4 py-6 text-sm">
            {message}
        </div>
    );
}
