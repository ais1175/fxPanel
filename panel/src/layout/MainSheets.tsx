import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ServerSidebar } from './ServerSidebar/ServerSidebar';
import { useGlobalMenuSheet, usePlayerlistSheet, useServerSheet } from '@/hooks/sheets';
import { MenuNavLink, NavLink } from '@/components/mainPageLink';
import {
    ClipboardCheckIcon,
    DoorOpenIcon,
    DownloadCloudIcon,
    FlagIcon,
    ListIcon,
    PieChartIcon,
    ScrollIcon,
    SettingsIcon,
    UserSquare2Icon,
    UsersIcon,
} from 'lucide-react';
import { PlayerlistSidebar } from './PlayerlistSidebar/PlayerlistSidebar';
import { useAdminPerms } from '@/hooks/auth';
import { LogoFullSquareGreen } from '@/components/logos';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';

export function GlobalMenuSheet() {
    const { isSheetOpen, setIsSheetOpen } = useGlobalMenuSheet();
    const { hasPerm } = useAdminPerms();

    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetContent
                side="left"
                className="xs:w-3/4 flex w-full flex-col gap-0 p-0 select-none"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <ScrollArea className="h-full px-6 [&_svg]:shrink-0">
                    <SheetHeader>
                        <SheetTitle className="py-6">
                            <NavLink href="/">
                                <LogoFullSquareGreen className="h-9 hover:scale-105 hover:brightness-110" />
                            </NavLink>
                        </SheetTitle>
                    </SheetHeader>

                    <div className="mb-4">
                        <h2 className="mb-1.5 text-lg font-semibold tracking-tight">Global Menu</h2>
                        <div className="xs:grid flex grid-cols-2 flex-row flex-wrap gap-4">
                            <MenuNavLink href="/players">
                                <UsersIcon className="mr-2 h-4 w-4" />
                                Players
                            </MenuNavLink>
                            <MenuNavLink href="/history">
                                <ScrollIcon className="mr-2 h-4 w-4" />
                                History
                            </MenuNavLink>
                            {hasPerm('players.reports') && (
                                <MenuNavLink href="/reports">
                                    <FlagIcon className="mr-2 h-4 w-4" />
                                    Reports
                                </MenuNavLink>
                            )}
                            <MenuNavLink href="/server/player-drops">
                                <DoorOpenIcon className="mr-2 h-4 w-4" />
                                Player Drops
                            </MenuNavLink>
                            <MenuNavLink href="/whitelist">
                                <ClipboardCheckIcon className="mr-2 h-4 w-4" />
                                Whitelist
                            </MenuNavLink>
                            <MenuNavLink href="/admins" disabled={!hasPerm('manage.admins')}>
                                <UserSquare2Icon className="mr-2 h-4 w-4" />
                                Admins
                            </MenuNavLink>
                            <MenuNavLink href="/settings" disabled={!hasPerm('settings.view')}>
                                <SettingsIcon className="mr-2 h-4 w-4" />
                                Settings
                            </MenuNavLink>
                        </div>
                    </div>
                    <div className="mb-4">
                        <h2 className="mb-1.5 text-lg font-semibold tracking-tight">System Menu</h2>
                        <div className="xs:grid flex grid-cols-2 flex-row flex-wrap gap-4">
                            <MenuNavLink href="/system/master-actions">Master Actions</MenuNavLink>
                            <MenuNavLink href="/system/diagnostics">
                                <PieChartIcon className="mr-2 h-4 w-4" />
                                Diagnostics
                            </MenuNavLink>
                            <MenuNavLink href="/system/console-log" disabled={!hasPerm('txadmin.log.view')}>
                                <ListIcon className="mr-2 h-4 w-4" />
                                Console Log
                            </MenuNavLink>
                            <MenuNavLink href="/system/action-log" disabled={!hasPerm('txadmin.log.view')}>
                                <ListIcon className="mr-2 h-4 w-4" />
                                Action Log
                            </MenuNavLink>
                            <MenuNavLink href="/system/artifacts" disabled={!hasPerm('all_permissions')}>
                                <DownloadCloudIcon className="mr-2 h-4 w-4" />
                                Artifacts
                            </MenuNavLink>
                        </div>
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

export function ServerSidebarSheet() {
    const { isSheetOpen, setIsSheetOpen } = useServerSheet();
    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetContent side="left" className="xs:w-3/4 w-full p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                <ScrollArea className="h-full">
                    <ServerSidebar isSheet />
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

export function PlayersSidebarSheet() {
    const { isSheetOpen, setIsSheetOpen } = usePlayerlistSheet();
    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetContent side="right" className="xs:w-3/4 w-full p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                <ScrollArea className="h-full">
                    <PlayerlistSidebar isSheet />
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

export default function MainSheets() {
    useSwipeGestures();
    return (
        <>
            <GlobalMenuSheet />
            <ServerSidebarSheet />
            <PlayersSidebarSheet />
        </>
    );
}
