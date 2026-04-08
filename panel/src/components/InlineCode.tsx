import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

type Props = HTMLAttributes<HTMLElement> & {
    children: React.ReactNode;
};

export default function InlineCode({ children, className, ...props }: Props) {
    return (
        <code className={cn('text-muted-foreground bg-muted rounded-sm px-1 font-mono', className)} {...props}>
            {children}
        </code>
    );
}
