import { Route, Switch } from 'wouter';
import Login from '../pages/auth/Login';
import TotpVerify from '../pages/auth/TotpVerify';
import DiscourseCallback from '../pages/auth/DiscourseCallback';
import AddMasterPin from '../pages/auth/AddMasterPin';
import AddMasterCallback from '../pages/auth/AddMasterCallback';
import { Card } from '../components/ui/card';
import { LogoFullSquareGreen } from '@/components/logos';
import { useThemedImage } from '@/hooks/theme';
import { handleExternalLinkClick } from '@/lib/navigation';
import { AuthError } from '@/pages/auth/errors';

function AuthContentWrapper({ children }: { children: React.ReactNode }) {
    return <div className="text-center">{children}</div>;
}

export default function AuthShell() {
    const customLogoUrl = useThemedImage(window.txConsts.providerLogo);
    return (
        <div className="pattern-dots flex min-h-screen items-center justify-center">
            <div className="xs:max-w-100 xs:mx-4 my-4 w-full min-w-[20rem]">
                {customLogoUrl ? (
                    <img
                        className="xs:max-w-56 xs:max-h-24 m-auto max-h-16 max-w-36"
                        src={customLogoUrl}
                        alt={window.txConsts.providerName}
                    />
                ) : (
                    <LogoFullSquareGreen className="xs:w-52 mx-auto w-36" />
                )}

                <Card className="xs:mt-8 bg-card/40 xs:rounded-lg mt-4 mb-4 flex min-h-80 items-center justify-center rounded-none">
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
                </Card>

                <div className="text-muted-foreground text-center text-sm font-light">
                    fxP: <strong>v{window.txConsts.txaVersion}</strong>
                    &nbsp;| fxS: <strong>b{window.txConsts.fxsVersion}</strong>
                </div>
            </div>
        </div>
    );
}
