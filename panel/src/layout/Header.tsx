import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { openExternalLink } from '@/lib/navigation';
import { KeyRoundIcon, LogOutIcon, Menu, Monitor, MoonIcon, PersonStanding } from 'lucide-react';
import DesktopNavbar from './DesktopNavbar';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/hooks/auth';
import { useGlobalMenuSheet, usePlayerlistSheet, useServerSheet } from '@/hooks/sheets';
import { FaDiscord } from 'react-icons/fa';
import { useAtomValue } from 'jotai';
import { serverNameAtom } from '@/hooks/status';
import { playerCountAtom } from '@/hooks/playerlist';
import { useAccountModal } from '@/hooks/dialogs';
import { LogoSquareGreen, LogoFullSquareGreen } from '@/components/logos';
import { NavLink } from '@/components/mainPageLink';
import { useShellBreakpoints } from '@/hooks/useShellBreakpoints';
import { useAddonWidgets } from '@/hooks/addons';

function ServerTitle() {
    const playerCount = useAtomValue(playerCountAtom);
    const serverName = useAtomValue(serverNameAtom);

    return (
        <div className="flex justify-start">
            <h1 className="line-clamp-1 text-base break-all">{serverName}</h1>
            <span>
                :&nbsp;
                <span className="font-mono" title="players connected">
                    {playerCount}
                </span>
            </span>
        </div>
    );
}

type NavButtonProps = {
    className?: string;
};
const navButtonClasses = `h-11 w-11 sm:h-10 sm:min-w-max sm:px-2 lg:px-3
    flex justify-center items-center gap-2
    transition-all ring-offset-background 
    focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
    rounded-md text-sm border
    bg-secondary/50 hover:bg-secondary border-border
`;

function ButtonToggleServerSheet({ className }: NavButtonProps) {
    const { setIsSheetOpen } = useServerSheet();
    return (
        <button className={cn(navButtonClasses, className)} title="Server Menu" onClick={() => setIsSheetOpen(true)}>
            <Monitor className="h-6 w-6 sm:h-5 sm:w-5" />
            <div className="hidden min-w-max flex-row align-middle sm:flex">Server</div>
        </button>
    );
}

function ButtonToggleGlobalMenu({ className }: NavButtonProps) {
    const { setIsSheetOpen } = useGlobalMenuSheet();
    return (
        <button className={cn(navButtonClasses, className)} title="Global Menu" onClick={() => setIsSheetOpen(true)}>
            <Menu className="h-6 w-6 sm:h-5 sm:w-5" />
            <div className="hidden min-w-max flex-row sm:flex">Menu</div>
        </button>
    );
}

function ButtonTogglePlayerlistSheet({ className, showCount }: NavButtonProps & { showCount: boolean }) {
    const { setIsSheetOpen } = usePlayerlistSheet();
    const playerCount = useAtomValue(playerCountAtom);

    return (
        <button className={cn(navButtonClasses, className)} title="Global Menu" onClick={() => setIsSheetOpen(true)}>
            <PersonStanding className="h-6 w-6 sm:h-5 sm:w-5" />
            <div className="hidden min-w-max flex-row sm:flex">
                Players
                {showCount && <span className="font-mono">: {playerCount}</span>}
            </div>
        </button>
    );
}

//Segmenting this into a component prevents full header rerenders
function AuthedHeaderFragment({ showName }: { showName: boolean }) {
    const { authData, logout } = useAuth();
    const { setAccountModalOpen } = useAccountModal();
    const headerDropdownWidgets = useAddonWidgets('header.dropdown');
    if (!authData) return null;
    const openAccountModal = () => {
        setAccountModalOpen(true);
    };
    const gotoSupportDiscord = () => {
        openExternalLink('https://discord.gg/6FcqBYwxH5');
    };
    const doLogout = () => logout();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="ring-offset-background focus-visible:ring-ring flex flex-row items-center gap-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden sm:gap-3">
                {showName && <span className="text-muted-foreground">{authData.name}</span>}
                <Avatar
                    className="hover:border-accent h-11 w-11 rounded-md text-2xl transition-all hover:border focus-visible:outline-hidden sm:h-10 sm:w-10"
                    username={authData.name}
                    profilePicture={authData.profilePicture}
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem className="cursor-pointer" onClick={openAccountModal}>
                    <KeyRoundIcon className="mr-2 h-4 w-4" />
                    Your Account
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={gotoSupportDiscord}>
                    <FaDiscord size="14" className="mr-2" />
                    Support
                </DropdownMenuItem>

                {/* Don't show logout if on NUI */}
                {window.txConsts.isWebInterface && (
                    <DropdownMenuItem className="cursor-pointer" onClick={doLogout}>
                        <LogOutIcon className="mr-2 h-4 w-4" />
                        Logout
                    </DropdownMenuItem>
                )}

                {/* Addon-injected dropdown items */}
                {headerDropdownWidgets.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        {headerDropdownWidgets.map((w) => (
                            <w.Component key={`${w.addonId}-${w.title}`} />
                        ))}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function Header() {
    const { isSm, isLg, isXl } = useShellBreakpoints();

    return (
        <header className="border-border/50 text-foreground sticky top-0 z-20 flex flex-col items-center justify-center border-b bg-[#11131c] shadow-xl shadow-black/20">
            <div className="flex h-14 w-full max-w-[1920px] flex-row justify-between px-2 transition-all lg:px-3">
                <div className="mr-5 flex grow flex-row items-center gap-5">
                    {isXl && (
                        <div className="w-sidebar flex justify-center">
                            <NavLink href="/">
                                <LogoFullSquareGreen className="h-9 hover:scale-105 hover:brightness-110" />
                            </NavLink>
                        </div>
                    )}
                    {!isXl && isSm && (
                        <NavLink href="/">
                            <LogoSquareGreen className="h-8 w-8 hover:scale-105 hover:brightness-110 lg:h-10 lg:w-10" />
                        </NavLink>
                    )}

                    {!isLg && <ServerTitle />}
                    {isLg && (
                        <nav className="grow">
                            <DesktopNavbar />
                        </nav>
                    )}
                </div>

                <div className="flex flex-row items-center gap-2 sm:gap-3">
                    {!isLg && <ButtonToggleServerSheet />}
                    {!isLg && <ButtonToggleGlobalMenu />}
                    {!isXl && <ButtonTogglePlayerlistSheet showCount={isLg} />}
                    <AuthedHeaderFragment showName={isXl} />
                </div>
            </div>
        </header>
    );
}
