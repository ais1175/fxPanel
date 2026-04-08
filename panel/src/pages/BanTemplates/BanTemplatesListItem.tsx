import { banDurationToString, cn } from '@/lib/utils';
import { BanDurationType } from '@shared/otherTypes';
import { Settings2Icon, XIcon } from 'lucide-react';

type BanTemplatesListItemProps = {
    id: string;
    reason: string;
    duration: BanDurationType;
    onEdit: (id: string) => void;
    onRemove: (id: string) => void;
    disabled: boolean;
};

export default function BanTemplatesListItem({
    id,
    reason,
    duration,
    onEdit,
    onRemove,
    disabled,
}: BanTemplatesListItemProps) {
    return (
        <>
            <div className="grow items-center justify-items-start gap-2 sm:flex">
                <span className="line-clamp-5 md:line-clamp-3">{reason}</span>
                <div
                    className={cn(
                        'my-1 w-max shrink-0 rounded border bg-black/40 px-2 py-0.5 text-sm uppercase select-none sm:my-0',
                        duration === 'permanent'
                            ? 'border-destructive bg-destructive-hint text-destructive'
                            : 'border-primary text-primary opacity-85',
                    )}
                >
                    {banDurationToString(duration)}
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    className={cn(
                        'text-muted-foreground',
                        disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-primary hover:scale-110',
                    )}
                    onClick={() => onEdit(id)}
                    disabled={disabled}
                >
                    <Settings2Icon className="size-6" />
                </button>
                <button
                    className={cn(
                        'text-muted-foreground',
                        disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-destructive hover:scale-110',
                    )}
                    onClick={() => onRemove(id)}
                    disabled={disabled}
                >
                    <XIcon className="size-6" />
                </button>
            </div>
        </>
    );
}
