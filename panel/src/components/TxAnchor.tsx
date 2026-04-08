import { cn } from '@/lib/utils';
import { openExternalLink } from '@/lib/navigation';
import { ExternalLinkIcon } from 'lucide-react';
import { useLocation } from 'wouter';

//Guarantees the icon doesn't break to the next line alone
function InnerExternal({ text }: { text: string }) {
    const words = text.split(/\s+/);
    const lastWord = words.pop();
    const startOfText = words.length ? words.join(' ') + ' ' : null;

    return (
        <>
            {startOfText}
            <span className="whitespace-nowrap">
                {lastWord}
                <ExternalLinkIcon className="mb-1 ml-1 inline h-5 selection:bg-inherit in-[.prose-sm]:ml-0 in-[.prose-sm]:h-4 in-[.text-sm]:ml-0 in-[.text-sm]:h-4" />
            </span>
        </>
    );
}

type TxAnchorType = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    className?: string;
    rel?: string;
};
export default function TxAnchor({ children, href, className, rel, ...rest }: TxAnchorType) {
    const setLocation = useLocation()[1];
    const isExternal = href?.startsWith('http') || href?.startsWith('//');
    const onClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        if (!href) return;
        e.preventDefault();
        if (isExternal) {
            openExternalLink(href);
        } else {
            setLocation(href ?? '/');
        }
    };
    return (
        <a
            {...rest}
            rel={rel ?? 'noopener noreferrer'}
            href={href}
            className={cn('text-accent mr-0 ml-1 cursor-pointer no-underline hover:underline', className)}
            onClick={onClick}
        >
            {isExternal && typeof children === 'string' ? <InnerExternal text={children} /> : children}
        </a>
    );
}
