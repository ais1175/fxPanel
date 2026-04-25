import { Route, Switch, useLocation } from 'wouter';
import Login from '../pages/auth/Login';
import TotpVerify from '../pages/auth/TotpVerify';
import DiscourseCallback from '../pages/auth/DiscourseCallback';
import DiscordCallback from '../pages/auth/DiscordCallback';
import AddMasterPin from '../pages/auth/AddMasterPin';
import AddMasterCallback from '../pages/auth/AddMasterCallback';
import { LogoFullSquareGreen } from '@/components/Logos';
import { useThemedImage } from '@/hooks/theme';
import { handleExternalLinkClick } from '@/lib/navigation';
import { AuthError } from '@/pages/auth/errors';
import { ServerGlowIcon } from '@/components/serverIcon';

function AuthContentWrapper({ children }: { children: React.ReactNode }) {
    return <div className="text-center">{children}</div>;
}

function BrandPanel() {
    const [location] = useLocation();
    const isMasterSetup = location.startsWith('/addMaster');
    // During master-account setup the server is not yet configured (often shows
    // the default 'change-me' name), so always show the fxPanel brand instead.
    const server = isMasterSetup ? undefined : window?.txConsts?.server;
    return (
        <div className="relative hidden xl:flex xl:w-[42%] flex-col justify-between overflow-hidden border-r border-border/40 p-12">
            {/* layered bg */}
            <div className="absolute inset-0 bg-[#0c0e16]" />
            {/* grid */}
            <div
                className="absolute inset-0 opacity-[0.035]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                }}
            />
            {/* accent glow top-left */}
            <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
            {/* accent glow bottom-right */}
            <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-accent/8 blur-3xl" />

            {/* Logo top */}
            <div className="relative z-10">
                <LogoFullSquareGreen className="w-32 opacity-90" />
            </div>

            {/* Center content */}
            <div className="relative z-10 flex flex-col gap-6">
                {server?.name ? (
                    <>
                        <div className="flex items-center gap-4">
                            <ServerGlowIcon
                                iconFilename={server.icon}
                                serverName={server.name}
                                gameName={server.game}
                            />
                            <div>
                                <div className="text-2xl font-semibold leading-tight text-foreground">{server.name}</div>
                                <div className="mt-0.5 text-sm text-muted-foreground">Sign in to manage your server</div>
                            </div>
                        </div>
                        <div className="h-px w-16 bg-accent/40" />
                    </>
                ) : (
                    <>
                        <div>
                            <div className="text-3xl font-semibold leading-tight text-foreground">
                                Welcome to<br />
                                <span className="text-accent">fxPanel</span>
                            </div>
                            <div className="mt-3 text-sm text-muted-foreground leading-relaxed">
                                Server management, simplified.
                            </div>
                        </div>
                        <div className="h-px w-16 bg-accent/40" />
                    </>
                )}
                <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-xs">
                    {server?.desc ?? 'Real-time performance monitoring, player management, and full server control — all in one place.'}
                </p>
            </div>

            {/* Version bottom */}
            <div className="relative z-10">
                <div className="text-xs text-muted-foreground/50 font-mono tracking-wide">
                    fxP&nbsp;<span className="text-muted-foreground/80">v{window.txConsts?.txaVersion ?? 'unknown'}</span>
                    <span className="mx-2 opacity-40">/</span>
                    fxS&nbsp;<span className="text-muted-foreground/80">b{window.txConsts?.fxsVersion ?? 'unknown'}</span>
                </div>
                <div className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground/35">
                    <a
                        href="https://github.com/SomeAussieGaymer/fxPanel/blob/main/LICENSE"
                        onClick={handleExternalLinkClick}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-muted-foreground/60 transition-colors"
                    >
                        &copy; 2026 SomeAussieGamer
                    </a>
                    <a
                        href="https://github.com/tabarra/txAdmin/blob/master/LICENSE"
                        onClick={handleExternalLinkClick}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-muted-foreground/60 transition-colors"
                    >
                        &copy; 2019&ndash;2025 Tabarra
                    </a>
                </div>
            </div>
        </div>
    );
}

export default function AuthShell() {
    const customLogoUrl = useThemedImage(window.txConsts.providerLogo);
    return (
        <div className="auth-bg flex min-h-screen">
            <BrandPanel />

            {/* Form panel */}
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 xl:px-16">
                {/* Mobile-only logo/provider logo */}
                <div className="mb-8 xl:hidden">
                    {customLogoUrl ? (
                        <img
                            className="max-h-14 max-w-40"
                            src={customLogoUrl}
                            alt={window.txConsts.providerName || 'Provider logo'}
                        />
                    ) : (
                        <LogoFullSquareGreen className="w-36" />
                    )}
                </div>

                <div className="w-full max-w-sm">
                    <Switch>
                        <Route path="/login">
                            <Login />
                        </Route>
                        <Route path="/login/totp">
                            <TotpVerify />
                        </Route>
                        <Route path="/login/discourse/callback">
                            <AuthContentWrapper>
                                <DiscourseCallback />
                            </AuthContentWrapper>
                        </Route>
                        <Route path="/login/discord/callback">
                            <AuthContentWrapper>
                                <DiscordCallback />
                            </AuthContentWrapper>
                        </Route>
                        <Route path="/addMaster/pin">
                            <AuthContentWrapper>
                                <AddMasterPin />
                            </AuthContentWrapper>
                        </Route>
                        <Route path="/addMaster/callback">
                            <AuthContentWrapper>
                                <AddMasterCallback />
                            </AuthContentWrapper>
                        </Route>
                        <Route path="/:fullPath*">
                            <AuthContentWrapper>
                                <AuthError
                                    error={{
                                        errorTitle: '404 | Not Found',
                                        errorMessage: 'Something went wrong.',
                                    }}
                                />
                            </AuthContentWrapper>
                        </Route>
                    </Switch>
                </div>

                {/* Mobile-only version info */}
                <div className="mt-10 xl:hidden text-center text-xs font-mono text-muted-foreground/40">
                    fxP v{window?.txConsts?.txaVersion ?? 'unknown'}&nbsp;/&nbsp;fxS b{window?.txConsts?.fxsVersion ?? 'unknown'}
                </div>
            </div>
        </div>
    );
}