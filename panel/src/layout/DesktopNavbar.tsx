import * as React from 'react';
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';
import { useRoute } from 'wouter';
import MainPageLink from '@/components/mainPageLink';
import { cva } from 'class-variance-authority';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdminPerms } from '@/hooks/auth';

const buttonVariants = cva(
    `group inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 ring-offset-background  focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`,
    {
        variants: {
            variant: {
                default: 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                secondary: 'bg-accent/15 text-accent',
            },
        },
    },
);

type HeaderMenuLinkProps = {
    href: string;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
};
function HeaderMenuLink(props: HeaderMenuLinkProps) {
    const [isActive] = useRoute(props.href);
    return (
        <NavigationMenuLink asChild active={isActive}>
            {props.disabled ? (
                <Tooltip>
                    <TooltipTrigger className="cursor-help">
                        <a
                            className={cn(
                                buttonVariants({ variant: 'default' }),
                                'pointer-events-none opacity-50',
                                props.className,
                            )}
                        >
                            {props.children}
                        </a>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-destructive-inline text-center">
                        You do not have permission <br />
                        to access this page.
                    </TooltipContent>
                </Tooltip>
            ) : (
                <MainPageLink
                    href={props.href}
                    isActive={isActive}
                    className={cn(buttonVariants({ variant: isActive ? 'secondary' : 'default' }), props.className)}
                >
                    {props.children}
                </MainPageLink>
            )}
        </NavigationMenuLink>
    );
}

function HeaderMenuItem(props: HeaderMenuLinkProps) {
    return (
        <NavigationMenuItem>
            <HeaderMenuLink href={props.href} disabled={props.disabled} className={props.className}>
                {props.children}
            </HeaderMenuLink>
        </NavigationMenuItem>
    );
}

//NOTE: breaking NavigationMenuItem into a separate menu because the dropdown is positioned wrong otherwise
export default function DesktopNavbar() {
    const { hasPerm } = useAdminPerms();

    return (
        <div className="flex flex-row space-x-1 select-none">
            <NavigationMenu>
                <NavigationMenuList>
                    <HeaderMenuItem href="/players">Players</HeaderMenuItem>
                    <HeaderMenuItem href="/history">History</HeaderMenuItem>
                    {hasPerm('players.reports') && <HeaderMenuItem href="/reports">Reports</HeaderMenuItem>}
                </NavigationMenuList>
            </NavigationMenu>

            <NavigationMenu>
                <NavigationMenuList>
                    <NavigationMenuItem>
                        <NavigationMenuTrigger
                            onClick={(e) => {
                                if (e.currentTarget.dataset['state'] === 'open') {
                                    e.preventDefault();
                                }
                            }}
                        >
                            Insights
                        </NavigationMenuTrigger>
                        <NavigationMenuContent className="flex list-none flex-col gap-2 p-4">
                            <HeaderMenuLink className="w-36 justify-start" href="/insights">
                                Overview
                            </HeaderMenuLink>
                            <HeaderMenuLink className="w-36 justify-start" href="/insights/player-drops">
                                Player Drops
                            </HeaderMenuLink>
                        </NavigationMenuContent>
                    </NavigationMenuItem>
                </NavigationMenuList>
            </NavigationMenu>

            <NavigationMenu>
                <NavigationMenuList>
                    <HeaderMenuItem href="/whitelist">Whitelist</HeaderMenuItem>
                    <HeaderMenuItem href="/admins" disabled={!hasPerm('manage.admins')}>
                        Admins
                    </HeaderMenuItem>
                    <HeaderMenuItem href="/settings" disabled={!hasPerm('settings.view')}>
                        Settings
                    </HeaderMenuItem>
                </NavigationMenuList>
            </NavigationMenu>

            <NavigationMenu>
                <NavigationMenuList className="aaaaaaaaaaa">
                    <NavigationMenuItem>
                        <NavigationMenuTrigger
                            onClick={(e) => {
                                //To prevent very annoying behavior where you go click on the menu
                                //item and it will close the menu because it just opened on hover
                                if (e.currentTarget.dataset['state'] === 'open') {
                                    e.preventDefault();
                                }
                            }}
                        >
                            System
                        </NavigationMenuTrigger>
                        <NavigationMenuContent className="flex list-none flex-col gap-2 p-4">
                            <HeaderMenuLink className="w-36 justify-start" href="/system/master-actions">
                                Master Actions
                            </HeaderMenuLink>
                            <HeaderMenuLink className="w-36 justify-start" href="/system/diagnostics">
                                Diagnostics
                            </HeaderMenuLink>
                            <HeaderMenuLink
                                className="w-36 justify-start"
                                href="/system/console-log"
                                disabled={!hasPerm('txadmin.log.view')}
                            >
                                Console Log
                            </HeaderMenuLink>
                            <HeaderMenuLink
                                className="w-36 justify-start"
                                href="/system/action-log"
                                disabled={!hasPerm('txadmin.log.view')}
                            >
                                Action Log
                            </HeaderMenuLink>
                            <HeaderMenuLink
                                className="w-36 justify-start"
                                href="/system/artifacts"
                                disabled={!hasPerm('all_permissions')}
                            >
                                Artifacts
                            </HeaderMenuLink>
                        </NavigationMenuContent>
                    </NavigationMenuItem>
                </NavigationMenuList>
            </NavigationMenu>
        </div>
    );
}
