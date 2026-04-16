import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useAdminPerms } from '@/hooks/auth';
import { memo, useEffect, useState } from 'react';
import { TabsTrigger, TabsList, TabsContent, Tabs } from '@/components/ui/tabs';
import {
    ApiChangeIdentifiersReq,
    ApiChangePasswordReq,
    ApiTotpSetupResp,
    ApiTotpConfirmResp,
    ApiTotpDisableResp,
} from '@shared/authApiTypes';
import { useAccountModal, useCloseAccountModal } from '@/hooks/dialogs';
import { GenericApiOkResp } from '@shared/genericApiTypes';
import { ApiTimeout, fetchWithTimeout, useAuthedFetcher, useBackendApi } from '@/hooks/fetch';
import consts from '@shared/consts';
import { txToast } from './txToaster';
import useSWR from 'swr';
import TxAnchor from './TxAnchor';
import QRCode from 'qrcode';

/**
 * Change Password tab
 */
const ChangePasswordTab = memo(function () {
    const { authData, setAuthData } = useAuth();
    const { setAccountModalTab } = useAccountModal();
    const closeAccountModal = useCloseAccountModal();
    const changePasswordApi = useBackendApi<GenericApiOkResp, ApiChangePasswordReq>({
        method: 'POST',
        path: '/auth/changePassword',
    });

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        if (!authData) return;
        setError('');

        if (newPassword.length < consts.adminPasswordMinLength || newPassword.length > consts.adminPasswordMaxLength) {
            setError(
                `The password must be between ${consts.adminPasswordMinLength} and ${consts.adminPasswordMaxLength} digits long.`,
            );
            return;
        } else if (newPassword !== newPasswordConfirm) {
            setError('The passwords do not match.');
            return;
        }

        setIsSaving(true);
        changePasswordApi({
            data: {
                newPassword,
                oldPassword: authData.isTempPassword ? undefined : oldPassword,
            },
            error: (error) => {
                setIsSaving(false);
                setError(error);
            },
            success: (data) => {
                setIsSaving(false);
                if ('success' in data) {
                    if (authData.isTempPassword) {
                        setAccountModalTab('identifiers');
                        setAuthData({
                            ...authData,
                            isTempPassword: false,
                        });
                    } else {
                        txToast.success('Password changed successfully!');
                        closeAccountModal();
                    }
                } else {
                    setError(data.error);
                }
            },
        });
    };

    if (!authData) return;
    return (
        <TabsContent value="password" tabIndex={undefined}>
            <form onSubmit={handleSubmit}>
                {authData.isTempPassword ? (
                    <p className="text-warning-inline text-sm">
                        Your account has a temporary password that needs to be changed before you can use this web
                        panel. <br />
                        <strong>Make sure to take note of your new password before saving.</strong>
                    </p>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        You can use your password to login to the fxPanel interface even without using the Cfx.re login
                        button.
                    </p>
                )}
                <div className="space-y-3 pt-2 pb-6">
                    {!authData.isTempPassword && (
                        <div className="space-y-1">
                            <Label htmlFor="current-password">Current Password</Label>
                            <Input
                                id="current-password"
                                placeholder="Enter current password"
                                type="password"
                                value={oldPassword}
                                autoFocus
                                required
                                onChange={(e) => {
                                    setOldPassword(e.target.value);
                                    setError('');
                                }}
                            />
                        </div>
                    )}
                    <div className="space-y-1">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                            id="new-password"
                            autoComplete="new-password"
                            placeholder="Enter new password"
                            type="password"
                            value={newPassword}
                            autoFocus={authData.isTempPassword}
                            required
                            onChange={(e) => {
                                setNewPassword(e.target.value);
                                setError('');
                            }}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                            id="confirm-password"
                            autoComplete="new-password"
                            placeholder="Repeat new password"
                            type="password"
                            required
                            onChange={(e) => {
                                setNewPasswordConfirm(e.target.value);
                                setError('');
                            }}
                        />
                    </div>
                </div>

                {error && <p className="text-destructive -mt-2 mb-4 text-center">{error}</p>}
                <Button className="w-full" type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : authData.isTempPassword ? 'Save & Next' : 'Change Password'}
                </Button>
            </form>
        </TabsContent>
    );
});

/**
 * Change Identifiers tab
 */
function ChangeIdentifiersTab() {
    const authedFetcher = useAuthedFetcher();
    const [cfxreId, setCfxreId] = useState('');
    const [discordId, setDiscordId] = useState('');
    const [error, setError] = useState('');
    const [isConvertingFivemId, setIsConvertingFivemId] = useState(false);
    const closeAccountModal = useCloseAccountModal();
    const [isSaving, setIsSaving] = useState(false);

    const currIdsResp = useSWR<ApiChangeIdentifiersReq>(
        '/auth/getIdentifiers',
        () => authedFetcher<ApiChangeIdentifiersReq>('/auth/getIdentifiers'),
        {
            //the data min interval is 5 mins, so we can safely cache for 1 min
            revalidateOnMount: true,
            revalidateOnFocus: false,
        },
    );

    useEffect(() => {
        if (!currIdsResp.data) return;
        setCfxreId(currIdsResp.data.cfxreId);
        setDiscordId(currIdsResp.data.discordId);
    }, [currIdsResp.data]);

    useEffect(() => {
        setError(currIdsResp.error?.message ?? '');
    }, [currIdsResp.error]);

    const changeIdentifiersApi = useBackendApi<GenericApiOkResp, ApiChangeIdentifiersReq>({
        method: 'POST',
        path: '/auth/changeIdentifiers',
    });

    const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        setError('');
        setIsSaving(true);
        changeIdentifiersApi({
            data: { cfxreId, discordId },
            error: (error) => {
                setError(error);
            },
            success: (data) => {
                setIsSaving(false);
                if ('success' in data) {
                    txToast.success('Identifiers changed successfully!');
                    closeAccountModal();
                } else {
                    setError(data.error);
                }
            },
        });
    };

    const handleCfxreIdBlur = async () => {
        if (!cfxreId) return;
        const trimmed = cfxreId.trim();
        if (/^\d+$/.test(trimmed)) {
            setCfxreId(`fivem:${trimmed}`);
        } else if (!trimmed.startsWith('fivem:')) {
            try {
                setIsConvertingFivemId(true);
                const forumData = await fetchWithTimeout(`https://forum.cfx.re/u/${trimmed}.json`);
                if (forumData.user && typeof forumData.user.id === 'number') {
                    setCfxreId(`fivem:${forumData.user.id}`);
                } else {
                    setError('Could not find the user in the forum. Make sure you typed the username correctly.');
                }
            } catch (error) {
                setError('Failed to check the identifiers on the forum API.');
            }
            setIsConvertingFivemId(false);
        } else if (cfxreId !== trimmed) {
            setCfxreId(trimmed);
        }
    };

    const handleDiscordIdBlur = () => {
        if (!discordId) return;
        const trimmed = discordId.trim();
        if (/^\d+$/.test(trimmed)) {
            setDiscordId(`discord:${trimmed}`);
        } else if (discordId !== trimmed) {
            setDiscordId(trimmed);
        }
    };

    return (
        <TabsContent value="identifiers" tabIndex={undefined}>
            <form onSubmit={handleSubmit}>
                <p className="text-muted-foreground text-sm">
                    The identifiers are optional for accessing the <strong>Web Panel</strong> but required for you to be
                    able to use the <strong>In Game Menu</strong> and the <strong>Discord Bot</strong>. <br />
                    <strong>It is recommended that you configure at least one.</strong>
                </p>
                <div className="space-y-3 pt-2 pb-6">
                    <div className="space-y-1">
                        <Label htmlFor="cfxreId">
                            FiveM identifier <span className="text-info text-sm opacity-75">(optional)</span>
                        </Label>
                        <Input
                            id="cfxreId"
                            autoCapitalize="none"
                            autoComplete="off"
                            autoCorrect="off"
                            placeholder="fivem:000000"
                            value={currIdsResp.isLoading || isConvertingFivemId ? 'loading...' : cfxreId}
                            disabled={currIdsResp.isLoading || isConvertingFivemId}
                            autoFocus
                            onBlur={handleCfxreIdBlur}
                            onChange={(e) => {
                                setCfxreId(e.target.value);
                                setError('');
                            }}
                        />
                        <p className="text-muted-foreground text-sm">
                            Your identifier can be found by clicking in your name in the playerlist and going to the IDs
                            page. <br />
                            You can also type in your <TxAnchor href="https://forum.cfx.re/">
                                forum.cfx.re
                            </TxAnchor>{' '}
                            username and it will be converted automatically. <br />
                            This is required if you want to login using the Cfx.re button.
                        </p>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="discordId">
                            Discord identifier <span className="text-info text-sm opacity-75">(optional)</span>
                        </Label>
                        <Input
                            id="discordId"
                            autoCapitalize="none"
                            autoComplete="off"
                            autoCorrect="off"
                            placeholder="discord:000000000000000000"
                            value={currIdsResp.isLoading ? 'loading...' : discordId}
                            disabled={currIdsResp.isLoading}
                            onBlur={handleDiscordIdBlur}
                            onChange={(e) => {
                                setDiscordId(e.target.value);
                                setError('');
                            }}
                        />
                        <p className="text-muted-foreground text-sm">
                            You can get your Discord User ID by following{' '}
                            <TxAnchor href="https://support.discordapp.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID">
                                this guide
                            </TxAnchor>
                            . <br />
                            This is required if you want to use the Discord Bot slash commands.
                        </p>
                    </div>
                </div>

                {error && <p className="text-destructive -mt-2 mb-4 text-center">{error}</p>}
                <Button className="w-full" type="submit" disabled={!currIdsResp || isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </form>
        </TabsContent>
    );
}

/**
 * Two-Factor Authentication tab
 */
function TwoFactorTab() {
    const { authData, setAuthData } = useAuth();
    const closeAccountModal = useCloseAccountModal();

    const [step, setStep] = useState<'status' | 'setup' | 'backup' | 'disable'>('status');
    const [setupUri, setSetupUri] = useState('');
    const [setupSecret, setSetupSecret] = useState('');
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [disablePassword, setDisablePassword] = useState('');
    const [disableCode, setDisableCode] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const authedFetcher = useAuthedFetcher();

    const is2faEnabled = authData?.totpEnabled ?? false;

    const handleStartSetup = async () => {
        setError('');
        setIsLoading(true);
        try {
            const data = await authedFetcher<ApiTotpSetupResp>('/auth/totp/setup', {
                method: 'POST',
            });
            if ('error' in data) {
                setError(data.error);
            } else {
                setSetupUri(data.uri);
                setSetupSecret(data.secret);
                try {
                    const dataUrl = await QRCode.toDataURL(data.uri, { width: 200, margin: 2 });
                    setQrDataUrl(dataUrl);
                } catch {
                    // QR generation failed - user can still manually enter
                }
                setStep('setup');
            }
        } catch (e) {
            setError('Failed to start 2FA setup.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmSetup = async () => {
        if (!verifyCode.trim()) return;
        setError('');
        setIsLoading(true);
        try {
            const data = await authedFetcher<ApiTotpConfirmResp>('/auth/totp/confirm', {
                method: 'POST',
                body: { code: verifyCode.trim() },
            });
            if ('error' in data) {
                setError(data.error);
            } else {
                setBackupCodes(data.backupCodes);
                setStep('backup');
                if (authData) {
                    setAuthData({ ...authData, totpEnabled: true });
                }
            }
        } catch (e) {
            setError('Failed to confirm 2FA setup.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisable = async () => {
        if (!disablePassword || !disableCode.trim()) return;
        setError('');
        setIsLoading(true);
        try {
            const data = await authedFetcher<ApiTotpDisableResp>('/auth/totp/disable', {
                method: 'POST',
                body: { password: disablePassword, code: disableCode.trim() },
            });
            if ('error' in data) {
                setError(data.error);
            } else {
                if (authData) {
                    setAuthData({ ...authData, totpEnabled: false });
                }
                setStep('status');
                setDisablePassword('');
                setDisableCode('');
                txToast.success('Two-factor authentication disabled.');
            }
        } catch (e) {
            setError('Failed to disable 2FA.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyBackupCodes = () => {
        navigator.clipboard.writeText(backupCodes.join('\n'));
        txToast.success('Backup codes copied to clipboard.');
    };

    if (!authData) return null;

    return (
        <TabsContent value="security" tabIndex={undefined}>
            {step === 'status' && (
                <div>
                    <p className="text-muted-foreground text-sm">
                        Two-factor authentication adds an extra layer of security to your account by requiring a code
                        from your authenticator app when logging in.
                    </p>
                    <div className="mt-4 flex items-center justify-between rounded-md border p-3">
                        <div>
                            <p className="text-sm font-medium">2FA Status</p>
                            <p className={`text-sm ${is2faEnabled ? 'text-success' : 'text-muted-foreground'}`}>
                                {is2faEnabled ? 'Enabled' : 'Disabled'}
                            </p>
                        </div>
                        {is2faEnabled ? (
                            <Button variant="destructive" size="sm" onClick={() => setStep('disable')}>
                                Disable 2FA
                            </Button>
                        ) : (
                            <Button size="sm" onClick={handleStartSetup} disabled={isLoading}>
                                {isLoading ? 'Loading...' : 'Enable 2FA'}
                            </Button>
                        )}
                    </div>
                    {error && <p className="text-destructive mt-2 text-center text-sm">{error}</p>}
                </div>
            )}

            {step === 'setup' && (
                <div>
                    <p className="text-muted-foreground mb-3 text-sm">
                        Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.), then
                        enter the 6-digit code to verify.
                    </p>
                    <div className="mb-3 flex justify-center">
                        {qrDataUrl ? (
                            <img
                                src={qrDataUrl}
                                alt="TOTP QR Code"
                                className="rounded-md border"
                                width={200}
                                height={200}
                            />
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                QR code unavailable. Enter the key manually below.
                            </p>
                        )}
                    </div>
                    <div className="mb-3">
                        <p className="text-muted-foreground mb-1 text-xs">Can't scan? Enter this key manually:</p>
                        <code className="bg-muted block rounded p-2 text-center font-mono text-xs break-all select-all">
                            {setupSecret}
                        </code>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="totp-verify-code">Verification Code</Label>
                        <Input
                            id="totp-verify-code"
                            type="text"
                            inputMode="numeric"
                            placeholder="000000"
                            maxLength={6}
                            value={verifyCode}
                            autoFocus
                            onChange={(e) => {
                                setVerifyCode(e.target.value);
                                setError('');
                            }}
                        />
                    </div>
                    {error && <p className="text-destructive mt-2 text-center text-sm">{error}</p>}
                    <div className="mt-4 flex gap-2">
                        <Button
                            variant="ghost"
                            className="flex-1"
                            onClick={() => {
                                setStep('status');
                                setError('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button className="flex-1" onClick={handleConfirmSetup} disabled={isLoading}>
                            {isLoading ? 'Verifying...' : 'Verify & Enable'}
                        </Button>
                    </div>
                </div>
            )}

            {step === 'backup' && (
                <div>
                    <p className="text-warning-inline mb-3 text-sm font-medium">
                        Save these backup codes in a safe place. Each code can only be used once. You won't be able to
                        see them again.
                    </p>
                    <div className="bg-muted mb-3 rounded-md p-3">
                        <div className="grid grid-cols-2 gap-1 font-mono text-sm">
                            {backupCodes.map((code, i) => (
                                <div key={i} className="text-center">
                                    {code}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={handleCopyBackupCodes}>
                            Copy Codes
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={() => {
                                setStep('status');
                                setBackupCodes([]);
                                setVerifyCode('');
                                setSetupUri('');
                                setSetupSecret('');
                                setQrDataUrl('');
                            }}
                        >
                            Done
                        </Button>
                    </div>
                </div>
            )}

            {step === 'disable' && (
                <div>
                    <p className="text-muted-foreground mb-3 text-sm">
                        To disable two-factor authentication, enter your current password and a 2FA code.
                    </p>
                    <div className="space-y-3 pb-4">
                        <div className="space-y-1">
                            <Label htmlFor="disable-password">Password</Label>
                            <Input
                                id="disable-password"
                                type="password"
                                placeholder="Enter your password"
                                value={disablePassword}
                                autoFocus
                                onChange={(e) => {
                                    setDisablePassword(e.target.value);
                                    setError('');
                                }}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="disable-code">2FA Code</Label>
                            <Input
                                id="disable-code"
                                type="text"
                                inputMode="numeric"
                                placeholder="000000"
                                maxLength={6}
                                value={disableCode}
                                onChange={(e) => {
                                    setDisableCode(e.target.value);
                                    setError('');
                                }}
                            />
                        </div>
                    </div>
                    {error && <p className="text-destructive -mt-2 mb-4 text-center text-sm">{error}</p>}
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            className="flex-1"
                            onClick={() => {
                                setStep('status');
                                setError('');
                                setDisablePassword('');
                                setDisableCode('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button variant="destructive" className="flex-1" onClick={handleDisable} disabled={isLoading}>
                            {isLoading ? 'Disabling...' : 'Disable 2FA'}
                        </Button>
                    </div>
                </div>
            )}
        </TabsContent>
    );
}

/**
 * Account Dialog
 */
export default function AccountDialog() {
    const { authData } = useAuth();
    const { hasPerm } = useAdminPerms();
    const { isAccountModalOpen, setAccountModalOpen, accountModalTab, setAccountModalTab } = useAccountModal();

    useEffect(() => {
        if (!authData) return;
        if (authData.isTempPassword) {
            setAccountModalOpen(true);
            setAccountModalTab('password');
        }
    }, []);

    const dialogSetIsClose = (newState: boolean) => {
        if (!newState && authData && !authData.isTempPassword) {
            setAccountModalOpen(false);
            setTimeout(() => {
                setAccountModalTab('password');
            }, 500);
        }
    };

    if (!authData) return;
    const canEditIdentifiers = window.txConsts.allowSelfIdentifierEdit || hasPerm('manage.admins');
    return (
        <Dialog open={isAccountModalOpen} onOpenChange={dialogSetIsClose}>
            <DialogContent className="sm:max-w-lg" tabIndex={undefined}>
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">
                        {authData.isTempPassword ? 'Welcome to fxPanel!' : `Your Account - ${authData.name}`}
                    </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="password" value={accountModalTab} onValueChange={setAccountModalTab}>
                    <TabsList className={`mb-4 grid w-full ${canEditIdentifiers ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        <TabsTrigger value="password">Password</TabsTrigger>
                        {canEditIdentifiers && (
                            <TabsTrigger value="identifiers" disabled={authData.isTempPassword}>
                                Identifiers
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="security" disabled={authData.isTempPassword}>
                            Security
                        </TabsTrigger>
                    </TabsList>
                    <ChangePasswordTab />
                    {canEditIdentifiers && <ChangeIdentifiersTab />}
                    <TwoFactorTab />
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
