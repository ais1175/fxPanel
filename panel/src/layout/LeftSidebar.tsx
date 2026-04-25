import { cn } from '@/lib/utils';
import { createContext, useContext, useState } from 'react';
import { useRoute } from 'wouter';
import MainPageLink from '@/components/MainPageLink';
import { useAdminPerms, useAuth } from '@/hooks/auth';
import { serverNameAtom, fxRunnerStateAtom, txConfigStateAtom } from '@/hooks/status';
import { playerCountAtom } from '@/hooks/playerlist';
import { useAtomValue } from 'jotai';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    LayoutDashboardIcon,
    UsersIcon,
    TerminalIcon,
    BoxIcon,
    ActivityIcon,
    TrendingDownIcon,
    BarChart3Icon,
    ClockIcon,
    FlagIcon,
    ShieldIcon,
    ClipboardListIcon,
    FileTextIcon,
    SlidersHorizontalIcon,
    PowerIcon,
    PowerOffIcon,
    RotateCcwIcon,
    KeyRoundIcon,
    LogOutIcon,
    Settings2Icon,
    ShieldCheckIcon,
    FileCodeIcon,
    PackageIcon,
    ScrollTextIcon,
    ChevronLeftIcon,
    BlocksIcon,
    WrenchIcon,
} from 'lucide-react';
import { LogoFullSquareGreen } from '@/components/Logos';
import { NavLink } from '@/components/MainPageLink';
import { TxConfigState } from '@shared/enums';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { ApiTimeout, useBackendApi } from '@/hooks/fetch';
import { useCloseAllSheets } from '@/hooks/sheets';
import { useAddonLoader } from '@/hooks/addons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FaDiscord } from 'react-icons/fa';
import { openExternalLink } from '@/lib/navigation';
import Avatar from '@/components/Avatar';
import { useAccountModal } from '@/hooks/dialogs';

// ─── Collapse context ─────────────────────────────────────────────────────────
const SidebarCollapsedCtx = createContext(false);
const useCollapsed = () => useContext(SidebarCollapsedCtx);

// ─── Sidebar nav item ────────────────────────────────────────────────────────
type SidebarNavItemProps = {
    href: string;
    icon: React.ElementType;
    label: string;
    disabled?: boolean;
};

function SidebarNavItem({ href, icon: Icon, label, disabled }: SidebarNavItemProps) {
    const [isActive] = useRoute(href);
    const collapsed = useCollapsed();

    if (disabled) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn(
                        'flex w-full cursor-not-allowed items-center rounded-md text-sm opacity-35 select-none text-muted-foreground',
                        collapsed ? 'justify-center py-2' : 'gap-3 px-3 py-2',
                    )}>
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{label}</span>}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-destructive-inline text-center">
                    {collapsed && <p className="mb-1 font-semibold">{label}</p>}
                    You do not have permission <br />to access this page.
                </TooltipContent>
            </Tooltip>
        );
    }

    if (collapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <MainPageLink
                        href={href}
                        isActive={isActive}
                        className={cn(
                            'flex w-full justify-center rounded-md py-2 transition-colors',
                            isActive
                                ? 'bg-accent/10 text-accent'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40',
                        )}
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                    </MainPageLink>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
        );
    }

    return (
        <MainPageLink
            href={href}
            isActive={isActive}
            className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors select-none',
                isActive
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40',
            )}
        >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 leading-none">{label}</span>
            {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
        </MainPageLink>
    );
}

// ─── Section group ───────────────────────────────────────────────────────────
function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
    const collapsed = useCollapsed();
    return (
        <div className="flex flex-col gap-0.5">
            {collapsed ? (
                <div className="mx-auto mt-3 h-px w-6 bg-border/40" />
            ) : (
                <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/40 select-none">
                    {label}
                </p>
            )}
            {children}
        </div>
    );
}

// ─── Sidebar server controls (labeled buttons) ───────────────────────────────
function SidebarServerControls() {
    const txConfigState = useAtomValue(txConfigStateAtom);
    const fxRunnerState = useAtomValue(fxRunnerStateAtom);
    const openConfirmDialog = useOpenConfirmDialog();
    const closeAllSheets = useCloseAllSheets();
    const { hasPerm } = useAdminPerms();
    const collapsed = useCollapsed();
    const fxsControlApi = useBackendApi({
        method: 'POST',
        path: '/fxserver/controls',
    });

    const handleControl = (action: 'start' | 'stop' | 'restart') => {
        const labels = { start: 'Starting server', stop: 'Stopping server', restart: 'Restarting server' };
        const callApi = () => {
            closeAllSheets();
            fxsControlApi({ data: { action }, toastLoadingMessage: `${labels[action]}...`, timeout: ApiTimeout.LONG });
        };
        if (action === 'start') {
            callApi();
        } else {
            openConfirmDialog({
                title: labels[action],
                message: `Are you sure you want to ${action} the server?`,
                onConfirm: callApi,
            });
        }
    };

    const hasControlPerm = hasPerm('control.server');

    if (txConfigState !== TxConfigState.Ready) {
        if (collapsed) return null;
        return <p className="text-center text-xs text-muted-foreground/50">Server not configured</p>;
    }

    const isRunning = !fxRunnerState.isIdle;
    const isAlive = fxRunnerState.isChildAlive;

    if (collapsed) {
        return (
            <div className="flex flex-col items-center gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => handleControl(isRunning ? 'stop' : 'start')}
                            disabled={!hasControlPerm}
                            className={cn(
                                'flex h-8 w-8 items-center justify-center rounded-md border text-xs transition-colors disabled:opacity-40 disabled:pointer-events-none',
                                isRunning
                                    ? 'border-destructive/40 bg-destructive/10 text-destructive-inline hover:bg-destructive/20'
                                    : 'border-success/40 bg-success/10 text-success-inline hover:bg-success/20',
                            )}
                        >
                            {isRunning ? <PowerOffIcon className="h-3.5 w-3.5" /> : <PowerIcon className="h-3.5 w-3.5" />}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{isRunning ? 'Stop server' : 'Start server'}</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => handleControl('restart')}
                            disabled={!hasControlPerm || !isAlive}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-info/40 bg-info/10 text-info-inline transition-colors hover:bg-info/20 disabled:pointer-events-none disabled:opacity-40"
                        >
                            <RotateCcwIcon className="h-3.5 w-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Restart server</TooltipContent>
                </Tooltip>
            </div>
        );
    }

    return (
        <div className="flex gap-1.5">
            <button
                onClick={() => handleControl(isRunning ? 'stop' : 'start')}
                disabled={!hasControlPerm}
                className={cn(
                    'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none',
                    isRunning
                        ? 'border-destructive/40 bg-destructive/10 text-destructive-inline hover:bg-destructive/20'
                        : 'border-success/40 bg-success/10 text-success-inline hover:bg-success/20',
                )}
                title={isRunning ? 'Stop server' : 'Start server'}
            >
                {isRunning ? <PowerOffIcon className="h-3.5 w-3.5" /> : <PowerIcon className="h-3.5 w-3.5" />}
                {isRunning ? 'Stop' : 'Start'}
            </button>

            <button
                onClick={() => handleControl('restart')}
                disabled={!hasControlPerm || !isAlive}
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-info/40 bg-info/10 text-xs font-medium text-info-inline transition-colors hover:bg-info/20 disabled:pointer-events-none disabled:opacity-40"
                title="Restart server"
            >
                <RotateCcwIcon className="h-3.5 w-3.5" />
                Restart
            </button>
        </div>
    );
}

// ─── Bottom server status card ────────────────────────────────────────────────
function ServerStatusCard() {
    const serverName = useAtomValue(serverNameAtom);
    const playerCount = useAtomValue(playerCountAtom);
    const fxRunnerState = useAtomValue(fxRunnerStateAtom);
    const isOnline = fxRunnerState.isChildAlive;
    const collapsed = useCollapsed();

    if (collapsed) {
        return (
            <div className="flex flex-col items-center gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className={cn(
                            'h-2 w-2 rounded-full',
                            isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground/40',
                        )} />
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        <p className="font-semibold">{serverName}</p>
                        <p className="text-xs text-muted-foreground">{playerCount} {playerCount === 1 ? 'player' : 'players'} online</p>
                    </TooltipContent>
                </Tooltip>
                <SidebarServerControls />
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-border/50 bg-card/60 p-3">
            {/* Server name + indicator */}
            <div className="mb-2.5 flex items-start gap-2">
                <span className={cn(
                    'mt-1 h-2 w-2 shrink-0 rounded-full',
                    isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground/40',
                )} />
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight text-foreground">{serverName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        {playerCount} {playerCount === 1 ? 'player' : 'players'} online
                    </p>
                </div>
            </div>
            <SidebarServerControls />
        </div>
    );
}

// ─── User account dropdown ────────────────────────────────────────────────────
function SidebarUserButton() {
    const { authData, logout } = useAuth();
    const { setAccountModalOpen } = useAccountModal();
    const collapsed = useCollapsed();
    if (!authData) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className={cn(
                    'flex w-full items-center rounded-md text-sm transition-colors hover:bg-secondary/40 focus:outline-none',
                    collapsed ? 'justify-center px-0 py-1.5' : 'gap-2.5 px-2 py-2',
                )}>
                    <Avatar
                        className="h-7 w-7 shrink-0 rounded-md text-xs"
                        username={authData.name}
                        profilePicture={authData.profilePicture}
                    />
                    {!collapsed && (
                        <span className="flex-1 truncate text-left text-sm font-medium text-foreground leading-none">
                            {authData.name}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align={collapsed ? 'center' : 'start'} className="w-52">
                <DropdownMenuItem className="cursor-pointer" onClick={() => setAccountModalOpen(true)}>
                    <KeyRoundIcon className="mr-2 h-4 w-4" />
                    Your Account
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => openExternalLink('https://discord.gg/6FcqBYwxH5')}
                >
                    <FaDiscord size="14" className="mr-2" />
                    Support
                </DropdownMenuItem>
                {window.txConsts.isWebInterface && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer" onClick={() => logout()}>
                            <LogOutIcon className="mr-2 h-4 w-4" />
                            Logout
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function LeftSidebar() {
    const [collapsed, setCollapsed] = useState(() => {
        try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
    });

    const toggle = () => {
        const next = !collapsed;
        setCollapsed(next);
        try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
    };

    return (
        <SidebarCollapsedCtx.Provider value={collapsed}>
            <aside className={cn(
                'hidden h-screen shrink-0 flex-col border-r border-border/40 bg-[#0c0e16] transition-[width] duration-200 overflow-hidden lg:flex',
                collapsed ? 'w-14' : 'w-60',
            )}>
                {/* Logo + collapse toggle */}
                <div className={cn(
                    'flex h-14 shrink-0 items-center border-b border-border/40',
                    collapsed ? 'justify-center' : 'justify-between px-4',
                )}>
                    {collapsed ? (
                        <button
                            onClick={toggle}
                            className="flex h-8 w-8 items-center justify-center rounded-md opacity-90 hover:opacity-100 transition-opacity"
                            title="Expand sidebar"
                        >
                            <img src="/logo2.svg" alt="fxPanel" className="h-8 w-8 rounded-lg" />
                        </button>
                    ) : (
                        <>
                            <NavLink href="/" className="flex flex-1 items-center justify-center opacity-90 hover:opacity-100 transition-opacity">
                                <LogoFullSquareGreen className="h-8" />
                            </NavLink>
                            <button
                                onClick={toggle}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-secondary/40 hover:text-foreground"
                                title="Collapse sidebar"
                            >
                                <ChevronLeftIcon className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>

                {/* Navigation */}
                <SidebarNavContent />

                {/* Bottom: server status + user */}
                <div className={cn(
                    'shrink-0 border-t border-border/40 flex flex-col gap-2',
                    collapsed ? 'items-center p-2' : 'p-3',
                )}>
                    <ServerStatusCard />
                    <SidebarUserButton />
                </div>
            </aside>
        </SidebarCollapsedCtx.Provider>
    );
}

// ─── Reusable navigation body (used by desktop sidebar + mobile sheet) ────────
export function SidebarNavContent() {
    const { hasPerm } = useAdminPerms();
    const { pages: addonPages } = useAddonLoader();
    const collapsed = useCollapsed();

    return (
        <nav className={cn(
            'flex flex-1 flex-col overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            collapsed ? 'px-1' : 'px-2',
        )}>
            <SidebarSection label="Overview">
                <SidebarNavItem href="/" icon={LayoutDashboardIcon} label="Dashboard" />
            </SidebarSection>

            <SidebarSection label="Players">
                <SidebarNavItem href="/players" icon={UsersIcon} label="Players" />
                <SidebarNavItem href="/whitelist" icon={ShieldCheckIcon} label="Whitelist" />
                <SidebarNavItem href="/history" icon={ClockIcon} label="History" />
                <SidebarNavItem
                    href="/reports"
                    icon={FlagIcon}
                    label="Reports"
                    disabled={!hasPerm('players.reports')}
                />
            </SidebarSection>

            <SidebarSection label="Server">
                <SidebarNavItem
                    href="/server/console"
                    icon={TerminalIcon}
                    label="Live Console"
                    disabled={!hasPerm('console.view')}
                />
                <SidebarNavItem href="/server/resources" icon={BoxIcon} label="Resources" />
                <SidebarNavItem
                    href="/server/cfg-editor"
                    icon={FileCodeIcon}
                    label="CFG Editor"
                    disabled={!hasPerm('server.cfg.editor')}
                />
                <SidebarNavItem
                    href="/server/server-log"
                    icon={FileTextIcon}
                    label="Server Log"
                    disabled={!hasPerm('server.log.view')}
                />
                <SidebarNavItem
                    href="/admins"
                    icon={ShieldIcon}
                    label="Admins"
                    disabled={!hasPerm('manage.admins')}
                />
            </SidebarSection>

            <SidebarSection label="Analytics">
                <SidebarNavItem href="/insights" icon={ActivityIcon} label="Insights" />
                <SidebarNavItem href="/server/player-drops" icon={TrendingDownIcon} label="Player Drops" />
                <SidebarNavItem
                    href="/reports/analytics"
                    icon={BarChart3Icon}
                    label="Report Analytics"
                    disabled={!hasPerm('players.reports')}
                />
            </SidebarSection>

            <SidebarSection label="Addons">
                <SidebarNavItem
                    href="/addons"
                    icon={BlocksIcon}
                    label="Addon Manager"
                    disabled={!hasPerm('all_permissions')}
                />
                {addonPages.map((page) => (
                    <SidebarNavItem
                        key={page.path}
                        href={page.path}
                        icon={BlocksIcon}
                        label={page.title}
                        disabled={page.permission ? !hasPerm(page.permission) : false}
                    />
                ))}
            </SidebarSection>

            <SidebarSection label="System">
                <SidebarNavItem
                    href="/system/action-log"
                    icon={ClipboardListIcon}
                    label="Action Log"
                    disabled={!hasPerm('txadmin.log.view')}
                />
                <SidebarNavItem
                    href="/system/console-log"
                    icon={ScrollTextIcon}
                    label="Console Log"
                    disabled={!hasPerm('txadmin.log.view')}
                />
                <SidebarNavItem href="/system/diagnostics" icon={SlidersHorizontalIcon} label="Diagnostics" />
                <SidebarNavItem
                    href="/system/artifacts"
                    icon={PackageIcon}
                    label="Artifacts"
                    disabled={!hasPerm('all_permissions')}
                />
                <SidebarNavItem
                    href="/settings"
                    icon={Settings2Icon}
                    label="Settings"
                    disabled={!hasPerm('settings.view')}
                />
                {import.meta.env.DEV && (
                    <SidebarNavItem
                        href="/advanced"
                        icon={WrenchIcon}
                        label="Advanced"
                        disabled={!hasPerm('all_permissions')}
                    />
                )}
            </SidebarSection>

        </nav>
    );
}

// Re-export so the mobile sheet can use the same bottom controls.
export { ServerStatusCard, SidebarUserButton, SidebarCollapsedCtx };
