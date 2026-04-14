import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogInIcon } from 'lucide-react';
import { ApiOauthRedirectResp, ApiVerifyPasswordReq, ApiVerifyPasswordResp } from '@shared/authApiTypes';
import { useAuth } from '@/hooks/auth';

import { useLocation } from 'wouter';
import { fetchWithTimeout } from '@/hooks/fetch';
import { processFetchError } from './errors';
import { ServerGlowIcon } from '@/components/serverIcon';

function HeaderNoServer() {
    return (
        <div className="text-center">
            <div className="xs:text-2xl text-primary/85 line-clamp-1 text-xl font-semibold">
                {/* Server Unconfigured */}
                {/* Unconfigured Server */}
                {/* Server Not Configured */}
                {/* Server Not Yet Configured */}
                Welcome to fxPanel!
            </div>
            <div className="xs:text-base text-muted-foreground text-sm font-normal tracking-wide">
                {/* please login to set it up */}
                {/* login to configure it */}
                please login to continue
            </div>
        </div>
    );
}

function HeaderServerInfo() {
    const server = window.txConsts.server;
    if (!server || !server.name || (!server.game && !server.icon)) {
        return <HeaderNoServer />;
    }
    return (
        <>
            <ServerGlowIcon iconFilename={server.icon} serverName={server.name} gameName={server.game} />
            <div className="xs:h-full xs:justify-between flex grow flex-col">
                <div className="xs:text-2xl line-clamp-1 text-xl font-semibold">{server.name}</div>
                <div className="xs:text-base text-muted-foreground text-sm">Login to continue</div>
            </div>
        </>
    );
}

export enum LogoutReasonHash {
    NONE = '',
    LOGOUT = '#logout',
    EXPIRED = '#expired',
    UPDATED = '#updated',
    MASTER_ALREADY_SET = '#master_already_set',
    SHUTDOWN = '#shutdown',
}

export default function Login() {
    const { setAuthData } = useAuth();
    const usernameRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const [isFetching, setIsFetching] = useState(false);
    const setLocation = useLocation()[1];

    const onError = (error: any) => {
        const { errorTitle, errorMessage } = processFetchError(error);
        setErrorMessage(`${errorTitle}:\n${errorMessage}`);
    };

    const onErrorResponse = (error: string) => {
        if (error === 'no_admins_setup') {
            setErrorMessage('No admins set up.\nRedirecting...');
            setLocation('/addMaster/pin');
        } else {
            setErrorMessage(error);
        }
    };

    const handleLogin = async () => {
        try {
            setIsFetching(true);
            const data = await fetchWithTimeout<ApiVerifyPasswordResp, ApiVerifyPasswordReq>(
                `/auth/password?uiVersion=${encodeURIComponent(window.txConsts.txaVersion)}`,
                {
                    method: 'POST',
                    body: {
                        username: usernameRef.current?.value ?? '',
                        password: passwordRef.current?.value ?? '',
                    },
                },
            );
            if ('error' in data) {
                if (data.error === 'refreshToUpdate') {
                    window.location.href = `/login${LogoutReasonHash.UPDATED}`;
                    window.location.reload();
                } else {
                    onErrorResponse(data.error);
                }
            } else if ('totp_required' in data) {
                setLocation('/login/totp');
            } else {
                setAuthData(data);
            }
        } catch (error) {
            onError(error);
        } finally {
            setIsFetching(false);
        }
    };

    const handleDiscourseRedirect = async () => {
        try {
            setIsFetching(true);
            const data = await fetchWithTimeout<ApiOauthRedirectResp>(
                `/auth/discourse/redirect?origin=${encodeURIComponent(window.location.origin)}`,
            );
            if ('error' in data) {
                onErrorResponse(data.error);
                setIsFetching(false);
            } else {
                console.log('Redirecting to', data.authUrl);
                window.location.href = data.authUrl;
            }
        } catch (error) {
            onError(error);
            setIsFetching(false);
        }
    };

    const handleDiscordRedirect = async () => {
        try {
            setIsFetching(true);
            const data = await fetchWithTimeout<ApiOauthRedirectResp>(
                `/auth/discord/redirect?origin=${encodeURIComponent(window.location.origin)}`,
            );
            if ('error' in data) {
                onErrorResponse(data.error);
                setIsFetching(false);
            } else {
                console.log('Redirecting to', data.authUrl);
                window.location.href = data.authUrl;
            }
        } catch (error) {
            onError(error);
            setIsFetching(false);
        }
    };

    //Prefill username/password if dev pass enabled
    useEffect(() => {
        try {
            const rawLocalStorageStr = localStorage.getItem('authCredsAutofill');
            if (rawLocalStorageStr) {
                const [user, pass] = JSON.parse(rawLocalStorageStr);
                usernameRef.current!.value = user ?? '';
                passwordRef.current!.value = pass ?? '';
            }
        } catch (error) {
            console.error('Username/Pass autofill failed', error);
        }
    }, []);

    //Gets the message from the hash and clears it
    useEffect(() => {
        const hash = window.location.hash;
        if (!hash) return;
        if (hash === LogoutReasonHash.LOGOUT) {
            setErrorMessage('Logged Out.');
        } else if (hash === LogoutReasonHash.EXPIRED) {
            setErrorMessage('Session Expired.');
        } else if (hash === LogoutReasonHash.UPDATED) {
            setErrorMessage('fxPanel updated!\nPlease login again.');
        } else if (hash === LogoutReasonHash.MASTER_ALREADY_SET) {
            setErrorMessage('Master account already configured.');
        } else if (hash === LogoutReasonHash.SHUTDOWN) {
            setErrorMessage('The fxPanel server shut down.\nPlease start it again to be able to login.');
        }
        window.location.hash = '';
    }, []);

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                handleLogin();
            }}
            className="w-full rounded-[inherit]"
        >
            <CardHeader className="rounded-t-[inherit]">
                <CardTitle className="xs:h-16 flex h-14 flex-row items-center justify-center gap-4">
                    <HeaderServerInfo />
                </CardTitle>
            </CardHeader>
            <CardContent className="bg-card flex flex-col gap-4 rounded-b-[inherit] border-t pt-4">
                {/* Error message */}
                {errorMessage && (
                    <div className="text-destructive-inline text-center text-sm whitespace-pre-wrap">
                        {errorMessage}
                    </div>
                )}

                {/* Form */}
                <div className="xs:grid xs:gap-4 flex grid-cols-8 flex-col items-baseline gap-2">
                    <Label className="col-span-2" htmlFor="frm-login">
                        Username
                    </Label>
                    <Input
                        id="frm-login"
                        ref={usernameRef}
                        type="text"
                        placeholder="username"
                        autoCapitalize="off"
                        autoComplete="off"
                        className="col-span-6"
                        required
                    />
                </div>
                <div className="xs:grid xs:gap-4 flex grid-cols-8 flex-col items-baseline gap-2">
                    <Label className="col-span-2" htmlFor="frm-password">
                        Password
                    </Label>
                    <Input
                        id="frm-password"
                        ref={passwordRef}
                        type="password"
                        placeholder="password"
                        autoCapitalize="off"
                        autoComplete="off"
                        className="col-span-6"
                        required
                    />
                </div>

                {/* Buttons */}
                <Button variant="outline" disabled={isFetching}>
                    {isFetching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <LogInIcon className="mr-2 inline h-4 w-4" />
                    )}{' '}
                    Login
                </Button>
                <Button
                    className="border-none bg-[#F40552] text-white hover:bg-[#CF0948]"
                    variant="outline"
                    disabled={isFetching}
                    onClick={handleDiscourseRedirect}
                >
                    {isFetching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <LogInIcon className="mr-2 inline h-4 w-4" />
                    )}{' '}
                    Login with Cfx.re
                </Button>
                {window.txConsts.discordOAuthEnabled && (
                    <Button
                        className="border-none bg-[#5865F2] text-white hover:bg-[#4752C4]"
                        variant="outline"
                        disabled={isFetching}
                        onClick={handleDiscordRedirect}
                    >
                        {isFetching ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <LogInIcon className="mr-2 inline h-4 w-4" />
                        )}{' '}
                        Login with Discord
                    </Button>
                )}
            </CardContent>
        </form>
    );
}
