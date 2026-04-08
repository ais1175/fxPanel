import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, Loader2Icon } from 'lucide-react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import CardContentOverlay from '@/components/CardContentOverlay';
import { SettingsCardContext, SettingsPageContext } from './utils';

type SettingsCardShellProps = {
    cardCtx: SettingsCardContext;
    pageCtx: SettingsPageContext;
    advancedVisible?: boolean;
    advancedSetter?: (visible: boolean) => void;
    onClickSave: () => void;
    children: React.ReactNode;
};

export default function SettingsCardShell({
    cardCtx,
    pageCtx,
    advancedVisible,
    advancedSetter,
    onClickSave,
    children,
}: SettingsCardShellProps) {
    const [animationParent] = useAutoAnimate();
    const isCardPendingSave = pageCtx.cardPendingSave?.cardId === cardCtx.cardId;

    return (
        <div id={`tab-${cardCtx.cardId}`} data-show-advanced={advancedVisible} className="group/card">
            <Card className="xs:x max-xs:rounded-none max-xs:shadow-none bg-transparent">
                <ol className="bg-muted/50 text-muted-foreground flex flex-wrap items-center gap-1 border-b p-4 text-sm tracking-wide select-none sm:gap-2.5">
                    {cardCtx.tabName !== cardCtx.cardName ? (
                        <>
                            <li>{cardCtx.tabName}</li>
                            <ChevronRightIcon className="mt-0.5 inline size-3.5 align-text-top opacity-75" />
                            <li>{cardCtx.cardName} Settings</li>
                        </>
                    ) : (
                        <li>{cardCtx.tabName} Settings</li>
                    )}
                    {isCardPendingSave && (
                        // <div className="grow text-right xflex xitems-center xgap-1.5 xbg-lime-300">
                        //     <li className="text-warning-inline italicx tracking-wide">
                        //         You are in read-only mode because you do not have the <InlineCode>Settings: Change</InlineCode> permission.
                        //     </li>
                        //     <li className="text-warning-inline italic tracking-wide">you have unsaved changes</li>
                        // </div>
                        <li className="text-warning-inline tracking-wide italic">(unsaved changes)</li>
                    )}
                </ol>

                <div className="relative rounded-b-[inherit]">
                    <CardContent className="space-y-6 overflow-x-clip bg-transparent pt-6" ref={animationParent}>
                        {children}
                        <div className="xs:justify-start flex flex-wrap-reverse justify-center gap-2">
                            <Button size="xs" disabled={!isCardPendingSave || pageCtx.isReadOnly} onClick={onClickSave}>
                                Save {cardCtx.cardName} Settings
                                {pageCtx.isSaving && <Loader2Icon className="mt-0.5 inline h-3.5 animate-spin" />}
                            </Button>
                            {advancedVisible !== undefined && advancedSetter ? (
                                <Button size="xs" variant={'muted'} onClick={() => advancedSetter(!advancedVisible)}>
                                    {advancedVisible ? 'Discard' : 'Show'} Advanced
                                    {advancedVisible ? (
                                        <ChevronUpIcon className="ml-1.5 size-4" />
                                    ) : (
                                        <ChevronDownIcon className="ml-1.5 size-4" />
                                    )}
                                </Button>
                            ) : null}
                        </div>
                    </CardContent>
                    <CardContentOverlay loading={pageCtx.isLoading} error={pageCtx.swrError} />
                </div>
            </Card>
        </div>
    );
}
