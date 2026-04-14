import { useEventListener } from 'usehooks-ts';
import MainRouter from './MainRouter';
import { useExpireAuthData } from '../hooks/auth';
import { Header } from './Header';
import { ServerSidebar } from './ServerSidebar/ServerSidebar';
import { PlayerlistSidebar } from './PlayerlistSidebar/PlayerlistSidebar';
import MainSheets from './mainSheets';
import WarningBar from './WarningBar';
import AddonWarningBar from './AddonWarningBar';
import ConfirmDialog from '@/components/ConfirmDialog';
import PromptDialog from '@/components/PromptDialog';
import TxToaster from '@/components/txToaster';
import AccountDialog from '@/components/AccountDialog';
import { useOpenAccountModal } from '@/hooks/dialogs';
import PlayerModal from './PlayerModal/PlayerModal';
import { playerModalUrlParam, useOpenPlayerModal } from '@/hooks/playerModal';
import { navigate as setLocation } from 'wouter/use-browser-location';
import MainSocket from './MainSocket';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToggleTheme } from '@/hooks/theme';
import { hotkeyEventListener } from '@/lib/hotkeyEventListener';
import BreakpointDebugger from '@/components/BreakpointDebugger';
import ActionModal from './ActionModal/ActionModal';
import { useEffect } from 'react';
import { actionModalUrlParam, useOpenActionModal } from '@/hooks/actionModal';
import { useShellBreakpoints } from '@/hooks/useShellBreakpoints';

export default function MainShell() {
    const expireSession = useExpireAuthData();
    const openAccountModal = useOpenAccountModal();
    const openPlayerModal = useOpenPlayerModal();
    const openActionModal = useOpenActionModal();
    const toggleTheme = useToggleTheme();
    const { hasScaledViewportMismatch } = useShellBreakpoints();

    // Expose modal openers so addons can call them directly
    (window as any).txAddonApi = (window as any).txAddonApi || {};
    (window as any).txAddonApi.openPlayerModal = openPlayerModal;

    //Listener for messages from child iframes (legacy routes) or other sources
    useEventListener('message', (e: TxMessageEvent) => {
        if (e.data.type === 'logoutNotice') {
            expireSession('child iframe', 'got logoutNotice');
        } else if (e.data.type === 'openAccountModal') {
            openAccountModal();
        } else if (e.data.type === 'openPlayerModal') {
            openPlayerModal(e.data.ref);
        } else if (e.data.type === 'navigateToPage') {
            setLocation(e.data.href);
        } else if (e.data.type === 'globalHotkey' && e.data.action === 'toggleLightMode') {
            toggleTheme();
        }
    });

    //auto open the player or action modals
    useEffect(() => {
        const pageUrl = new URL(window.location.toString());
        const playerModalRef = pageUrl.searchParams.get(playerModalUrlParam);
        const actionModalRef = pageUrl.searchParams.get(actionModalUrlParam);
        if (!playerModalRef && !actionModalRef) return;

        if (playerModalRef) {
            if (playerModalRef.includes('#')) {
                const [mutex, rawNetid] = playerModalRef.split('#');
                const netid = parseInt(rawNetid);
                if (mutex.length && rawNetid.length && !isNaN(netid)) {
                    return openPlayerModal({ mutex, netid });
                }
            } else if (playerModalRef.length) {
                return openPlayerModal({ license: playerModalRef });
            }
        } else if (actionModalRef && actionModalRef.length) {
            return openActionModal(actionModalRef);
        }

        //Remove the query params
        pageUrl.searchParams.delete(playerModalUrlParam);
        pageUrl.searchParams.delete(actionModalUrlParam);
        window.history.replaceState({}, '', pageUrl);
    }, []);

    useEffect(() => {
        const densityMode = hasScaledViewportMismatch ? 'compact' : 'default';
        document.documentElement.dataset.txShellDensity = densityMode;

        return () => {
            delete document.documentElement.dataset.txShellDensity;
        };
    }, [hasScaledViewportMismatch]);

    //Listens to hotkeys (doesn't work if the focus is on an iframe)
    useEventListener('keydown', hotkeyEventListener);

    return (
        <>
            <TooltipProvider delayDuration={300} disableHoverableContent={true}>
                <Header />
                <div className="mx-auto flex min-h-full w-full max-w-[1920px] flex-row gap-4 pt-(--page-pt) pb-(--page-pb) md:px-3 2xl:px-8">
                    <ServerSidebar />
                    <main className="min-h-contentvh flex min-w-96 flex-1">
                        <MainRouter />
                    </main>
                    {window.txConsts.isWebInterface && <PlayerlistSidebar />}
                </div>

                <MainSheets />
                <WarningBar />
                <AddonWarningBar />
                <ConfirmDialog />
                <PromptDialog />
                <TxToaster />
                <AccountDialog />
                <PlayerModal />
                <ActionModal />
                <MainSocket />
                {/* <BreakpointDebugger /> */}
            </TooltipProvider>
        </>
    );
}
