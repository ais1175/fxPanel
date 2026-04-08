import { useState, useEffect, useRef } from 'react';
import { useBackendApi, ApiTimeout } from '@/hooks/fetch';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Loader2Icon,
    DownloadIcon,
    RotateCcwIcon,
    AlertTriangleIcon,
    CheckCircle2Icon,
    XCircleIcon,
    ExternalLinkIcon,
} from 'lucide-react';
import type { ArtifactListResp, ArtifactTierInfo } from '@shared/otherTypes';
import type { ApiToastResp } from '@shared/genericApiTypes';
import { emsg } from '@shared/emsg';

const tierLabels: Record<ArtifactTierInfo['tier'], { label: string; desc: string }> = {
    latest: { label: 'Latest', desc: 'Newest available build' },
    recommended: { label: 'Recommended', desc: 'Stable and tested' },
    optional: { label: 'Optional', desc: 'Minor fixes and improvements' },
    critical: { label: 'Critical', desc: 'Minimum safe version' },
};

function StatusSection({
    data,
    onApply,
    onReset,
}: {
    data: ArtifactListResp;
    onApply: () => void;
    onReset: () => void;
}) {
    const { updateStatus } = data;
    if (updateStatus.phase === 'idle') return null;

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                {updateStatus.phase === 'downloading' && (
                    <div className="space-y-2">
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                            Downloading... {updateStatus.percentage}%
                        </div>
                        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                            <div
                                className="bg-primary h-full rounded-full transition-all duration-300"
                                style={{ width: `${updateStatus.percentage}%` }}
                            />
                        </div>
                    </div>
                )}
                {updateStatus.phase === 'extracting' && (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        Extracting archive...
                    </div>
                )}
                {updateStatus.phase === 'extracted' && (
                    <>
                        <Alert>
                            <CheckCircle2Icon className="h-4 w-4" />
                            <AlertTitle>Download Complete</AlertTitle>
                            <AlertDescription>
                                The artifact has been downloaded and extracted. Click &quot;Apply &amp; Restart&quot; to
                                install it.
                            </AlertDescription>
                        </Alert>
                        <Button variant="warning" onClick={onApply}>
                            <RotateCcwIcon className="mr-2 h-4 w-4" />
                            Apply &amp; Restart
                        </Button>
                    </>
                )}
                {updateStatus.phase === 'applying' && (
                    <Alert>
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        <AlertTitle>Applying Update</AlertTitle>
                        <AlertDescription>
                            The server is being updated and will restart momentarily. This page will become
                            unresponsive.
                        </AlertDescription>
                    </Alert>
                )}
                {updateStatus.phase === 'error' && (
                    <>
                        <Alert variant="destructive">
                            <AlertTriangleIcon className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{updateStatus.message}</AlertDescription>
                        </Alert>
                        <Button variant="outline" onClick={onReset}>
                            Dismiss
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default function FxUpdaterPage() {
    const [data, setData] = useState<ArtifactListResp | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const customUrlRef = useRef<HTMLInputElement>(null);
    const openConfirmDialog = useOpenConfirmDialog();

    const listApi = useBackendApi<ArtifactListResp>({
        method: 'GET',
        path: '/fxserver/artifacts',
    });
    const downloadApi = useBackendApi<ApiToastResp, { url: string; version: string }>({
        method: 'POST',
        path: '/fxserver/artifacts/download',
    });
    const applyApi = useBackendApi<ApiToastResp>({
        method: 'POST',
        path: '/fxserver/artifacts/apply',
    });

    const fetchStatus = async () => {
        try {
            const resp = await listApi({ timeout: ApiTimeout.LONG });
            if (resp) {
                setData(resp);
                setFetchError(null);
            }
        } catch (e) {
            setFetchError(emsg(e));
        } finally {
            setIsLoading(false);
        }
    };

    //Poll every 2s while downloading/applying, 30s otherwise
    useEffect(() => {
        fetchStatus();
        const interval = setInterval(
            () => {
                fetchStatus();
            },
            data?.updateStatus.phase === 'downloading' ||
                data?.updateStatus.phase === 'extracting' ||
                data?.updateStatus.phase === 'applying'
                ? 2000
                : 30000,
        );
        return () => clearInterval(interval);
    }, [data?.updateStatus.phase]);

    const handleDownload = (url: string, version: string) => {
        downloadApi({
            data: { url, version },
            toastLoadingMessage: 'Starting download...',
        });
        //Optimistically show downloading state so UI updates immediately
        setData((prev) => (prev ? { ...prev, updateStatus: { phase: 'downloading', percentage: 0 } } : prev));
    };

    const handleCustomDownload = () => {
        const url = customUrlRef.current?.value?.trim();
        if (!url) return;
        if (!url.startsWith('https://')) {
            return;
        }
        handleDownload(url, 'custom');
    };

    const handleApply = () => {
        openConfirmDialog({
            title: 'Apply Artifact Update',
            message:
                'This will stop the game server, replace the artifact files, and restart the entire fxPanel process. Make sure you have warned your players. Continue?',
            confirmBtnVariant: 'warning',
            onConfirm: () => {
                applyApi({
                    toastLoadingMessage: 'Applying update...',
                    timeout: ApiTimeout.REALLY_REALLY_LONG,
                });
            },
        });
    };

    const handleReset = () => {
        setData((prev) => (prev ? { ...prev, updateStatus: { phase: 'idle' } } : prev));
    };

    if (isLoading && !data) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2Icon className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="mx-auto w-full max-w-2xl space-y-4 px-2 md:px-0">
                <h1 className="mb-2 text-3xl">Artifacts</h1>
                <Alert variant="destructive">
                    <XCircleIcon className="h-4 w-4" />
                    <AlertTitle>Failed to load artifact data</AlertTitle>
                    <AlertDescription>{fetchError}</AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!data) return null;

    const { currentVersion, currentVersionTag, tiers, updateStatus } = data;
    const isBusy =
        updateStatus.phase !== 'idle' && updateStatus.phase !== 'error' && updateStatus.phase !== 'extracted';

    return (
        <div className="mx-auto w-full max-w-2xl space-y-4 px-2 md:px-0">
            <div className="px-2 md:px-0">
                <h1 className="mb-2 text-3xl">Artifacts</h1>
                <p className="text-muted-foreground">
                    Download and install FXServer artifacts. The same server binary is used for both FiveM and RedM.
                </p>
            </div>

            {/* Current Version */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Current Version</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-2xl font-bold">{currentVersion}</span>
                        <Badge variant="secondary">{currentVersionTag}</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Download/Apply Status */}
            <StatusSection data={data} onApply={handleApply} onReset={handleReset} />

            {/* Available Artifact Tiers */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Available Builds</CardTitle>
                    <CardDescription>Select an artifact version to download</CardDescription>
                </CardHeader>
                <CardContent>
                    {tiers.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center text-sm">
                            Could not fetch available builds. Try refreshing the page.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {tiers.map((tier) => {
                                const info = tierLabels[tier.tier];
                                const isCurrent = tier.version === currentVersion;
                                return (
                                    <div
                                        key={tier.tier}
                                        className="bg-card flex items-center justify-between rounded-md border p-3"
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{info.label}</span>
                                                <span className="text-muted-foreground font-mono text-sm">
                                                    #{tier.version}
                                                </span>
                                                {isCurrent && (
                                                    <Badge variant="outline" className="text-xs">
                                                        Current
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="text-muted-foreground text-xs">{info.desc}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant={isCurrent ? 'muted' : 'default'}
                                            disabled={isBusy}
                                            onClick={() => handleDownload(tier.downloadUrl, tier.version.toString())}
                                        >
                                            <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
                                            Download
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Custom URL Download */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Custom Artifact URL</CardTitle>
                    <CardDescription>
                        Paste a direct download link to any FXServer or RedM artifact build
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input
                            ref={customUrlRef}
                            placeholder="https://runtime.fivem.net/artifacts/fivem/..."
                            disabled={isBusy}
                        />
                        <Button disabled={isBusy} onClick={handleCustomDownload}>
                            <DownloadIcon className="mr-2 h-4 w-4" />
                            Download
                        </Button>
                    </div>
                    <div className="mt-3 flex gap-4">
                        <a
                            href="https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent inline-flex items-center gap-1 text-xs hover:underline"
                        >
                            FiveM Artifacts <ExternalLinkIcon className="h-3 w-3" />
                        </a>
                        <a
                            href="https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent inline-flex items-center gap-1 text-xs hover:underline"
                        >
                            FiveM Linux Artifacts <ExternalLinkIcon className="h-3 w-3" />
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
