import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { setPlayerModalUrlParam, usePlayerModalStateValue } from '@/hooks/playerModal';
import { InfoIcon, ListIcon, HistoryIcon, GavelIcon, SearchIcon, ActivityIcon, BlocksIcon } from 'lucide-react';
import PlayerInfoTab from './PlayerInfoTab';
import PlayerInsightsTab from './PlayerInsightsTab';
import { useEffect, useState } from 'react';
import PlayerIdsTab from './PlayerIdsTab';
import { ScrollArea } from '@/components/ui/scroll-area';
import PlayerHistoryTab from './PlayerHistoryTab';
import PlayerBanTab from './PlayerBanTab';
import PlayerActivityTab from './PlayerActivityTab';
import GenericSpinner from '@/components/GenericSpinner';
import { cn } from '@/lib/utils';
import { useBackendApi } from '@/hooks/fetch';
import { PlayerModalResp, PlayerModalSuccess } from '@shared/playerApiTypes';
import PlayerModalFooter from './PlayerModalFooter';
import ModalCentralMessage from '@/components/ModalCentralMessage';
import { useAddonWidgets } from '@/hooks/addons';
import { ErrorBoundary } from 'react-error-boundary';

const modalTabs = [
    {
        title: 'Info',
        icon: <InfoIcon className="xs:block mr-2 hidden h-5 w-5" />,
    },
    {
        title: 'Insights',
        icon: <SearchIcon className="xs:block mr-2 hidden h-5 w-5" />,
    },
    {
        title: 'Activity',
        icon: <ActivityIcon className="xs:block mr-2 hidden h-5 w-5" />,
    },
    {
        title: 'History',
        icon: <HistoryIcon className="xs:block mr-2 hidden h-5 w-5" />,
    },
    {
        title: 'IDs',
        icon: <ListIcon className="xs:block mr-2 hidden h-5 w-5" />,
    },
    {
        title: 'Ban',
        icon: <GavelIcon className="xs:block mr-2 hidden h-5 w-5" />,
        className: 'hover:bg-destructive hover:text-destructive-foreground',
    },
];

export default function PlayerModal() {
    const { isModalOpen, closeModal, playerRef } = usePlayerModalStateValue();
    const [selectedTab, setSelectedTab] = useState(modalTabs[0].title);
    const [currRefreshKey, setCurrRefreshKey] = useState(0);
    const [modalData, setModalData] = useState<PlayerModalSuccess | undefined>(undefined);
    const [modalError, setModalError] = useState('');
    const [tsFetch, setTsFetch] = useState(0);
    const addonTabs = useAddonWidgets('player-modal.tabs');
    const addonActions = useAddonWidgets('player-modal.actions');
    const playerQueryApi = useBackendApi<PlayerModalResp>({
        method: 'GET',
        path: `/player`,
        abortOnUnmount: true,
    });

    //Helper for tabs to be able to refresh the modal data
    const refreshModalData = () => {
        setCurrRefreshKey(currRefreshKey + 1);
    };

    //Querying player data when reference is available
    useEffect(() => {
        if (!playerRef) return;
        setModalData(undefined);
        setModalError('');
        playerQueryApi({
            queryParams: playerRef,
            success: (resp) => {
                if ('error' in resp) {
                    setModalError(resp.error);
                } else {
                    setModalData(resp);
                    setTsFetch(Math.round(Date.now() / 1000));
                    //Update the ref param to use a license, if possible
                    if (!('license' in playerRef) && resp.player.license) {
                        setPlayerModalUrlParam(resp.player.license);
                    }
                }
            },
            error: (error) => {
                setModalError(error);
            },
        });
    }, [playerRef, currRefreshKey]);

    //Resetting selected tab when modal is closed
    useEffect(() => {
        if (!isModalOpen) {
            setTimeout(() => {
                setSelectedTab(modalTabs[0].title);
            }, 200);
        }
    }, [isModalOpen]);

    const handleOpenClose = (newOpenState: boolean) => {
        if (isModalOpen && !newOpenState) {
            closeModal();
        }
    };

    //Move to tab up or down
    const handleTabButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const currentIndex = modalTabs.findIndex((tab) => tab.title === selectedTab);
            const nextIndex = e.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
            const nextTab = modalTabs[nextIndex];
            if (nextTab) {
                setSelectedTab(nextTab.title);
                const nextButton = document.getElementById(`player-modal-tab-${nextTab.title}`);
                if (nextButton) {
                    nextButton.focus();
                }
            }
        }
    };

    let pageTitle: JSX.Element;
    if (modalData) {
        if (modalData.player.netid) {
            pageTitle = (
                <>
                    <span className="text-success-inline mr-2 font-mono">[{modalData.player.netid}]</span>
                    {modalData.player.displayName}
                </>
            );
        } else {
            pageTitle = (
                <>
                    <span className="text-destructive-inline mr-2 font-mono">[OFF]</span>
                    {modalData.player.displayName}
                </>
            );
        }
    } else if (modalError) {
        pageTitle = <span className="text-destructive-inline">Error!</span>;
    } else {
        pageTitle = <span className="text-muted-foreground italic">Loading...</span>;
    }

    return (
        <Dialog open={isModalOpen} onOpenChange={handleOpenClose}>
            <DialogContent
                className="flex h-full max-h-full max-w-2xl flex-col gap-1 p-0 sm:h-auto sm:gap-4"
                // onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader className="border-b px-4 py-3">
                    <DialogTitle className="mr-6 line-clamp-1 leading-7 tracking-wide break-all">
                        {pageTitle}
                    </DialogTitle>
                    <DialogDescription className="sr-only">Player details and actions</DialogDescription>
                </DialogHeader>

                <div className="flex h-full flex-col md:flex-row md:px-4">
                    <div className="bg-muted mx-2 flex flex-row gap-1 rounded-md p-1 md:mx-0 md:flex-col md:bg-transparent md:p-0">
                        {modalTabs.map((tab) => (
                            <Button
                                id={`player-modal-tab-${tab.title}`}
                                key={tab.title}
                                variant={selectedTab === tab.title ? 'secondary' : 'ghost'}
                                className={cn(
                                    'w-full justify-center tracking-wider md:justify-start',
                                    'h-7 rounded-sm px-2 text-sm',
                                    'md:h-10 md:text-base',
                                    tab.className,
                                )}
                                onClick={() => setSelectedTab(tab.title)}
                                onKeyDown={handleTabButtonKeyDown}
                            >
                                {tab.icon} {tab.title}
                            </Button>
                        ))}
                        {addonTabs.length > 0 && (
                            <>
                                <hr className="my-1 hidden border-border md:block" />
                                {addonTabs.map((w) => (
                                    <Button
                                        key={`addon-${w.addonId}-${w.title}`}
                                        variant={selectedTab === `addon:${w.addonId}:${w.title}` ? 'secondary' : 'ghost'}
                                        className={cn(
                                            'w-full justify-center tracking-wider md:justify-start',
                                            'h-7 rounded-sm px-2 text-sm',
                                            'md:h-10 md:text-base',
                                        )}
                                        onClick={() => setSelectedTab(`addon:${w.addonId}:${w.title}`)}
                                    >
                                        <BlocksIcon className="xs:block mr-2 hidden h-5 w-5" /> {w.title}
                                    </Button>
                                ))}
                            </>
                        )}
                    </div>
                    {/* NOTE: consistent height: sm:h-66 */}
                    <ScrollArea className="max-h-[calc(100dvh-3.125rem-4rem-5rem)] min-h-66 w-full px-4 py-2 md:max-h-[50vh] md:py-0">
                        {!modalData ? (
                            <ModalCentralMessage>
                                {modalError ? (
                                    <span className="text-destructive-inline">Error: {modalError}</span>
                                ) : (
                                    <GenericSpinner msg="Loading..." />
                                )}
                            </ModalCentralMessage>
                        ) : (
                            <>
                                {selectedTab === 'Info' && (
                                    <PlayerInfoTab
                                        playerRef={playerRef!}
                                        player={modalData.player}
                                        serverTime={modalData.serverTime}
                                        tsFetch={tsFetch}
                                        setSelectedTab={setSelectedTab}
                                        refreshModalData={refreshModalData}
                                        tagDefinitions={modalData.tagDefinitions}
                                    />
                                )}
                                {selectedTab === 'Insights' && (
                                    <PlayerInsightsTab player={modalData.player} serverTime={modalData.serverTime} />
                                )}
                                {selectedTab === 'Activity' && (
                                    <PlayerActivityTab player={modalData.player} serverTime={modalData.serverTime} />
                                )}
                                {selectedTab === 'History' && (
                                    <PlayerHistoryTab
                                        actionHistory={modalData.player.actionHistory}
                                        serverTime={modalData.serverTime}
                                        refreshModalData={refreshModalData}
                                    />
                                )}
                                {selectedTab === 'IDs' && (
                                    <PlayerIdsTab player={modalData.player} refreshModalData={refreshModalData} />
                                )}
                                {selectedTab === 'Ban' && <PlayerBanTab playerRef={playerRef!} />}
                                {addonTabs.map((w) => (
                                    selectedTab === `addon:${w.addonId}:${w.title}` && (
                                        <ErrorBoundary key={`${w.addonId}-${w.title}`} fallback={<div className="p-4 text-sm text-destructive">Addon tab error: {w.title}</div>}>
                                            <w.Component
                                                license={modalData.player.license}
                                                displayName={modalData.player.displayName}
                                                netid={modalData.player.netid}
                                                playerRef={playerRef}
                                            />
                                        </ErrorBoundary>
                                    )
                                ))}
                            </>
                        )}
                    </ScrollArea>
                </div>
                <PlayerModalFooter playerRef={playerRef!} player={modalData?.player} addonActions={addonActions} />
            </DialogContent>
        </Dialog>
    );
}
