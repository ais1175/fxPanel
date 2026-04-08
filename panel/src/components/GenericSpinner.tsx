import { Loader2Icon } from 'lucide-react';

type GenericSpinnerProps = {
    msg?: string;
};
export default function GenericSpinner({ msg }: GenericSpinnerProps) {
    return (
        <div className="text-muted-foreground flex items-center gap-1 text-xl leading-relaxed">
            <Loader2Icon className="inline h-5 animate-spin" /> {msg}
        </div>
    );
}
