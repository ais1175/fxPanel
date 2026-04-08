import { Loader2Icon, OctagonXIcon } from 'lucide-react';

type CardContentOverlayProps = {
    loading?: boolean;
    error?: React.ReactNode;
    message?: React.ReactNode;
};
export default function CardContentOverlay({ loading, error, message }: CardContentOverlayProps) {
    let innerNode: React.ReactNode;
    if (loading) {
        innerNode = <Loader2Icon className="size-20 animate-spin opacity-75" />;
    } else if (error) {
        innerNode = (
            <>
                <OctagonXIcon className="text-destructive-inline size-16 opacity-75" />
                <span className="text-destructive-inline max-w-4xl text-xl">{error}</span>
            </>
        );
    } else if (message) {
        innerNode = <span className="text-muted-foreground/75 max-w-4xl text-2xl tracking-wider">{message}</span>;
    } else {
        return null;
    }
    return (
        <div className="absolute inset-0 z-10 flex min-h-20 flex-col items-center justify-center gap-2 rounded-[inherit] bg-black/25 px-4 py-6 text-center backdrop-blur-xs">
            {innerNode}
        </div>
    );
}
