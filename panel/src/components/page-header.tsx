import { CalendarIcon, ChevronRightIcon, SaveIcon, UserIcon } from 'lucide-react';
import { ConfigChangelogEntry } from '@shared/otherTypes';
import { useMemo, useState } from 'react';
import { dateToLocaleDateString, dateToLocaleTimeString, isDateToday, tsToLocaleDateTimeString } from '@/lib/dateTime';
import TxAnchor from '@/components/TxAnchor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'wouter';

//MARK: PageHeaderChangelog
type PageHeaderChangelogProps = {
    changelogData?: ConfigChangelogEntry[];
};
export function PageHeaderChangelog({ changelogData }: PageHeaderChangelogProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const mostRecent = useMemo(() => {
        if (!changelogData?.length) return null;
        const last = changelogData[changelogData.length - 1];
        const lastDate = new Date(last.ts);
        const timeStr = dateToLocaleTimeString(lastDate, '2-digit', '2-digit');
        const dateStr = dateToLocaleDateString(lastDate, 'long');
        const titleTimeIndicator = isDateToday(lastDate) ? timeStr : dateStr;
        return {
            author: last.author,
            dateTime: titleTimeIndicator,
        };
    }, [changelogData]);

    const reversedChangelog = useMemo(() => {
        if (!changelogData) return null;
        return [...changelogData].reverse();
    }, [changelogData]);

    const handleOpenChangelog = () => {
        setIsModalOpen(true);
    };

    const placeholder = Array.isArray(changelogData) ? 'No changes yet' : 'loading...';

    return (
        <>
            <div className="xs:flex-col max-xs:items-center max-xs:gap-2 max-xs:w-full text-muted-foreground group relative flex rounded-lg px-2 py-1">
                {reversedChangelog?.length ? (
                    <div
                        className="bg-card text-primary group-active:bg-primary group-active:text-primary-foreground absolute inset-0 flex cursor-pointer items-center justify-center rounded-[inherit] border opacity-0 transition-opacity select-none group-hover:opacity-100 group-active:border-none"
                        onClick={handleOpenChangelog}
                    >
                        View Changelog
                    </div>
                ) : null}
                <div className="leading-3 font-semibold tracking-wider">
                    <SaveIcon className="max-xs:hidden inline-block size-4 align-text-bottom" /> Last Updated
                    <span className="xs:hidden">:</span>
                </div>
                <div className="text-xs">
                    <CalendarIcon className="inline-block size-4 align-text-bottom" />{' '}
                    {mostRecent?.dateTime ?? placeholder}
                </div>
                {/* <div className='text-xs'>
                <UserIcon className='size-4 inline-block align-text-bottom' /> {mostRecent?.author ?? placeholder}
            </div> */}
            </div>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-xl max-sm:p-4">
                    <DialogHeader>
                        <DialogTitle>Recent Changes</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[80vh] space-y-3 overflow-auto pr-3" style={{ scrollbarWidth: 'thin' }}>
                        {reversedChangelog?.map((entry, i) => (
                            <ChangelogEntry key={i} entry={entry} />
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function ChangelogEntry({ entry }: { entry: ConfigChangelogEntry }) {
    return (
        <div className="odd:bg-card/75 flex flex-col gap-2 rounded-md border px-3 py-2">
            <div className="flex items-center justify-between">
                <div className="text-accent font-semibold">
                    <UserIcon className="mr-2 inline-block size-5 align-text-bottom opacity-65" />
                    {entry.author}
                </div>
                <div className="text-muted-foreground text-sm">
                    {tsToLocaleDateTimeString(entry.ts, 'short', 'short')}
                </div>
            </div>
            <div className="flex flex-wrap gap-1 text-sm">
                {entry.keys.length ? (
                    entry.keys.map((cfg, index) => (
                        <span>
                            <div
                                key={cfg}
                                className="bg-secondary/50 inline rounded px-1 py-0.5 font-mono tracking-wide"
                            >
                                {cfg}
                            </div>
                            {index < entry.keys.length - 1 && ','}
                        </span>
                    ))
                ) : (
                    <div className="italic">No changes</div>
                )}
            </div>
        </div>
    );
}

//MARK: PageHeaderLinks
type PageHeaderLinksProps = {
    topLabel: string;
    topLink: string;
    bottomLabel: string;
    bottomLink: string;
};
export function PageHeaderLinks(props: PageHeaderLinksProps) {
    return (
        <div className="max-xs:gap-2 xs:flex-col flex px-2 py-1">
            <TxAnchor href={props.topLink} className="text-sm">
                {props.topLabel}
            </TxAnchor>
            <TxAnchor href={props.bottomLink} className="text-sm">
                {props.bottomLabel}
            </TxAnchor>
        </div>
    );
}

//MARK: PageHeader
type PageHeaderProps = {
    title: string;
    icon: React.ReactNode;
    parentName?: string;
    parentLink?: string;
    children?: React.ReactNode;
};
export function PageHeader(props: PageHeaderProps) {
    const titleNodes = useMemo(() => {
        if (props.parentName && props.parentLink) {
            return (
                <>
                    <Link href={props.parentLink} className="hover:text-secondary-foreground hover:underline">
                        {props.parentName}
                    </Link>
                    <ChevronRightIcon className="opacity-75" />
                    <li className="text-secondary-foreground">{props.title}</li>
                </>
            );
        } else {
            return <li className="text-secondary-foreground">{props.title}</li>;
        }
    }, [props]);
    return (
        <header className="mb-4 border-b">
            <div className="xbg-blue-700 max-xs:pb-2 xs:min-h-16 max-xs:flex-col xs:gap-4 max-xs:items-start flex items-center justify-between gap-2 px-4 py-2">
                <ol className="xbg-green-500 text-muted-foreground flex flex-wrap items-center gap-1 text-2xl leading-none sm:gap-2.5">
                    <span className="opacity-75">{props.icon}</span>
                    {titleNodes}
                </ol>
                {props.children}
            </div>
        </header>
    );
}
