import { useState } from 'react';
import { useBackendApi } from '@/hooks/fetch';
import { txToast } from '@/components/txToaster';
import { Button } from '@/components/ui/button';
import { Loader2Icon } from 'lucide-react';
import useSWR from 'swr';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ApiTimeout } from '@/hooks/fetch';

type DiagnosticsData = {
    message: string;
    host?: {
        error?: string;
        static?: {
            nodeVersion: string;
            osDistro: string;
            username: string;
            cpu: {
                manufacturer: string;
                brand: string;
                physicalCores: number;
                cores: number;
                speedMin: number;
            };
        };
        dynamic?: {
            cpuUsage: number;
            memory: {
                usage: number | null;
                used: number | null;
                total: number | null;
            };
        };
    };
    txadmin: {
        uptime: string;
        databaseFileSize: string;
        txEnv: {
            fxsPath: string;
            profilePath: string;
        };
        txHostConfig: {
            defaults: string[];
            netInterface?: string;
            providerName?: string;
        };
        monitor: {
            hbFails: { http: number; fd3: number };
            restarts: {
                bootTimeout: number;
                close: number;
                heartBeat: number;
                healthCheck: number;
                both: number;
            };
        };
        performance: {
            banCheck: string;
            whitelistCheck: string;
            playersTableSearch: string;
            historyTableSearch: string;
            databaseSave: string;
            perfCollection: string;
        };
        memoryUsage: {
            heap_used: string;
            heap_limit: string;
            heap_pct: string;
            physical: string;
            peak_malloced: string;
        };
        logger: {
            storageSize: string;
            statusAdmin: string;
            statusFXServer: string;
            statusServer: string;
        };
    };
    fxserver?: {
        error?: string | false;
        versionMismatch?: boolean;
        status?: string;
        statusColor?: string;
        version?: string;
        resources?: number;
        onesync?: string;
        maxClients?: number;
        txAdminVersion?: string;
    };
    processes?: Array<{
        pid: number;
        name: string;
        ppid: number;
        memory: number | null;
        cpu: number | null;
    }>;
};

type SendReportResp = {
    reportId?: string;
    error?: string;
};

function CpuBadge({ cores, speed }: { cores: number; speed: number }) {
    if (speed <= 2.4) {
        return (
            <span className="bg-destructive text-destructive-foreground ml-1 rounded px-1.5 py-0.5 text-xs font-bold">
                VERY SLOW!
            </span>
        );
    }
    if (speed < 3.0 && cores < 8) {
        return (
            <span className="bg-warning text-warning-foreground ml-1 rounded px-1.5 py-0.5 text-xs font-bold">
                SLOW
            </span>
        );
    }
    return null;
}

export default function DiagnosticsPage() {
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportState, setReportState] = useState<'info' | 'loading' | 'success' | 'error'>('info');
    const [reportId, setReportId] = useState('');
    const [reportError, setReportError] = useState('');

    const dataApi = useBackendApi<DiagnosticsData>({
        method: 'GET',
        path: '/diagnostics/data',
    });

    const reportApi = useBackendApi<SendReportResp>({
        method: 'POST',
        path: '/diagnostics/sendReport',
    });

    const {
        data,
        error: swrError,
        isLoading,
    } = useSWR('/diagnostics/data', async () => {
        let resp: DiagnosticsData | undefined;
        let fetchError: string | undefined;
        await dataApi({
            success: (d) => {
                resp = d;
            },
            error: (msg) => {
                fetchError = msg;
            },
        });
        if (fetchError) throw new Error(fetchError);
        return resp;
    });

    const handleSendReport = () => {
        setReportState('loading');
        reportApi({
            data: { bugfix: true },
            timeout: ApiTimeout.REALLY_REALLY_LONG,
            success(d) {
                if (d.error) {
                    setReportState('error');
                    setReportError(d.error);
                } else if (d.reportId) {
                    setReportState('success');
                    setReportId(d.reportId);
                } else {
                    setReportState('error');
                    setReportError('Unknown backend error.');
                }
            },
            error(msg) {
                setReportState('error');
                setReportError(msg);
            },
        });
    };

    if (isLoading || (!data && !swrError)) {
        return (
            <div className="flex min-h-96 items-center justify-center">
                <Loader2Icon className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (swrError || !data) {
        return (
            <div className="flex min-h-96 flex-col items-center justify-center gap-2">
                <p className="text-destructive">Failed to load diagnostics data.</p>
                <p className="text-muted-foreground text-sm">{swrError?.message ?? 'Unknown error'}</p>
            </div>
        );
    }

    const { host, txadmin, fxserver, processes } = data;

    return (
        <div className="mx-auto w-full max-w-(--breakpoint-xl) space-y-4 px-2 md:px-0">
            <div className="px-2 md:px-0">
                <h1 className="mb-2 text-3xl">Diagnostics</h1>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Left column */}
                <div className="space-y-4">
                    {/* Environment */}
                    <div className="border-destructive/30 rounded-lg border p-4">
                        <h2 className="mb-3 text-lg font-bold">Environment</h2>
                        {!host ? (
                            <p className="text-muted-foreground text-sm">Host data not available.</p>
                        ) : host.error ? (
                            <p className="text-destructive">{host.error}</p>
                        ) : host.static ? (
                            <div className="space-y-1 text-sm">
                                <p>
                                    <strong>Node:</strong> {host.static.nodeVersion}
                                </p>
                                <p>
                                    <strong>OS:</strong> {host.static.osDistro}
                                </p>
                                <p>
                                    <strong>Username:</strong> {host.static.username}
                                </p>
                                <p>
                                    <strong>CPU Model:</strong> {host.static.cpu.manufacturer} {host.static.cpu.brand}
                                </p>
                                <p>
                                    <strong>CPU Stats:</strong> {host.static.cpu.physicalCores}c/{host.static.cpu.cores}
                                    t - {host.static.cpu.speedMin} GHz
                                    <CpuBadge cores={host.static.cpu.cores} speed={host.static.cpu.speedMin} />
                                </p>
                                {host.dynamic ? (
                                    <>
                                        <p>
                                            <strong>CPU Usage:</strong> {host.dynamic.cpuUsage}%
                                        </p>
                                        <p>
                                            <strong>Memory:</strong> {host.dynamic.memory.usage ?? '--'}% (
                                            {host.dynamic.memory.used?.toFixed(2) ?? '--'}/{host.dynamic.memory.total?.toFixed(2) ?? '--'}
                                            )
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-muted-foreground italic">Dynamic usage data not available.</p>
                                )}
                            </div>
                        ) : null}
                    </div>

                    {/* fxPanel Runtime */}
                    <div className="border-destructive/30 rounded-lg border p-4">
                        <h2 className="mb-3 text-lg font-bold">fxPanel Runtime</h2>
                        <div className="space-y-1 text-sm">
                            <p>
                                <strong>Uptime:</strong> <code>{txadmin.uptime}</code>
                            </p>
                            <p>
                                <strong>Versions:</strong> <code>v{window.txConsts.txaVersion}</code> /{' '}
                                <code>b{window.txConsts.fxsVersion}</code>
                            </p>
                            <p>
                                <strong>Database File Size:</strong> <code>{txadmin.databaseFileSize}</code>
                            </p>
                            <div>
                                <strong>Env:</strong>
                                <div className="text-muted-foreground ml-2">
                                    <p>
                                        ├─ FXServer: <code>{txadmin.txEnv.fxsPath}</code>
                                    </p>
                                    <p>
                                        ├─ Profile: <code>{txadmin.txEnv.profilePath}</code>
                                    </p>
                                    <p>
                                        ├─ Defaults:{' '}
                                        <code>
                                            {txadmin.txHostConfig.defaults.length > 0
                                                ? txadmin.txHostConfig.defaults.join(', ')
                                                : '--'}
                                        </code>
                                    </p>
                                    <p>
                                        ├─ Interface: <code>{txadmin.txHostConfig.netInterface ?? '--'}</code>
                                    </p>
                                    <p>
                                        └─ Provider: <code>{txadmin.txHostConfig.providerName ?? '--'}</code>
                                    </p>
                                </div>
                            </div>
                            <div>
                                <strong>Monitor:</strong>
                                <div className="text-muted-foreground ml-2">
                                    <p>
                                        ├─ HB Fails: <code>HTTP {txadmin.monitor.hbFails.http}</code> /{' '}
                                        <code>FD3 {txadmin.monitor.hbFails.fd3}</code>
                                    </p>
                                    <p>
                                        └─ Restarts: <code>BT {txadmin.monitor.restarts.bootTimeout}</code> /{' '}
                                        <code>CL {txadmin.monitor.restarts.close}</code> /{' '}
                                        <code>HB {txadmin.monitor.restarts.heartBeat}</code> /{' '}
                                        <code>HC {txadmin.monitor.restarts.healthCheck}</code> /{' '}
                                        <code>BO {txadmin.monitor.restarts.both}</code>
                                    </p>
                                </div>
                            </div>
                            <div>
                                <strong>Performance Times:</strong>
                                <div className="text-muted-foreground ml-2">
                                    <p>
                                        ├─ BanCheck: <code>{txadmin.performance.banCheck}</code>
                                    </p>
                                    <p>
                                        ├─ WhitelistCheck: <code>{txadmin.performance.whitelistCheck}</code>
                                    </p>
                                    <p>
                                        ├─ PlayersTable: <code>{txadmin.performance.playersTableSearch}</code>
                                    </p>
                                    <p>
                                        ├─ HistoryTable: <code>{txadmin.performance.historyTableSearch}</code>
                                    </p>
                                    <p>
                                        ├─ DatabaseSave: <code>{txadmin.performance.databaseSave}</code>
                                    </p>
                                    <p>
                                        └─ PerfCollection: <code>{txadmin.performance.perfCollection}</code>
                                    </p>
                                </div>
                            </div>
                            <div>
                                <strong>Memory:</strong>
                                <div className="text-muted-foreground ml-2">
                                    <p>
                                        ├─ Heap:{' '}
                                        <code>
                                            {txadmin.memoryUsage.heap_used} / {txadmin.memoryUsage.heap_limit} (
                                            {txadmin.memoryUsage.heap_pct}%)
                                        </code>
                                    </p>
                                    <p>
                                        ├─ Physical: <code>{txadmin.memoryUsage.physical}</code>
                                    </p>
                                    <p>
                                        └─ Peak. Alloc.: <code>{txadmin.memoryUsage.peak_malloced}</code>
                                    </p>
                                </div>
                            </div>
                            <div>
                                <strong>Logger Status:</strong>
                                <div className="text-muted-foreground ml-2">
                                    <p>
                                        ├─ Storage Size: <code>{txadmin.logger.storageSize}</code>
                                    </p>
                                    <p>
                                        ├─ Admin: <code>{txadmin.logger.statusAdmin}</code>
                                    </p>
                                    <p>
                                        ├─ FXServer: <code>{txadmin.logger.statusFXServer}</code>
                                    </p>
                                    <p>
                                        └─ Server: <code>{txadmin.logger.statusServer}</code>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="text-muted-foreground text-center text-sm">{data.message}</p>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                    {/* Diagnostics Report */}
                    <div className="border-info/30 rounded-lg border p-4">
                        <h2 className="mb-3 text-lg font-bold">Diagnostics Report</h2>
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-sm">
                                To receive fxPanel Support, it is recommended that you send the diagnostics data
                                directly to the Support Team.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setReportState('info');
                                    setReportModalOpen(true);
                                }}
                            >
                                Review Details & Send Data
                            </Button>
                        </div>
                    </div>

                    {/* FXServer Info */}
                    <div className="border-info/30 rounded-lg border p-4">
                        <h2 className="mb-3 text-lg font-bold">FXServer /info.json</h2>
                        {!fxserver ? (
                            <p className="text-muted-foreground text-sm">FXServer data not available.</p>
                        ) : (<>
                        {fxserver.versionMismatch && (
                            <div className="bg-destructive/10 border-destructive/30 mb-3 rounded border p-3 text-center text-sm">
                                <strong className="text-destructive">
                                    This version doesn't match fxPanel's version!
                                </strong>
                                <br />
                                If you just updated FXServer, restart fxPanel. Otherwise, it means FXServer was already
                                running before fxPanel started, and nothing is going to work properly.
                            </div>
                        )}
                        {fxserver.error !== false && fxserver.error ? (
                            <p className="text-destructive">{fxserver.error}</p>
                        ) : (
                            <div className="space-y-1 text-sm">
                                <p>
                                    <strong>Status: </strong>
                                    <span
                                        className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                                            fxserver.statusColor === 'success'
                                                ? 'bg-success/20 text-success'
                                                : fxserver.statusColor === 'warning'
                                                  ? 'bg-warning/20 text-warning'
                                                  : fxserver.statusColor === 'danger'
                                                    ? 'bg-destructive/20 text-destructive'
                                                    : 'bg-secondary text-secondary-foreground'
                                        }`}
                                    >
                                        {fxserver.status}
                                    </span>
                                </p>
                                <p>
                                    <strong>Version:</strong> {fxserver.version}
                                </p>
                                <p>
                                    <strong>Resources:</strong> {fxserver.resources}
                                </p>
                                <p>
                                    <strong>OneSync:</strong> {fxserver.onesync}
                                </p>
                                <p>
                                    <strong>Max Clients:</strong> {fxserver.maxClients}
                                </p>
                                <p>
                                    <strong>fxPanel Version:</strong> {fxserver.txAdminVersion}
                                </p>
                            </div>
                        )}
                        </>)}
                    </div>

                    {/* Processes */}
                    <div className="border-info/30 rounded-lg border p-4">
                        <h2 className="mb-3 text-lg font-bold">Processes</h2>
                        {!processes?.length ? (
                            <p className="text-muted-foreground text-sm">
                                Failed to retrieve process data. Check the terminal for more information (if verbosity
                                is enabled).
                            </p>
                        ) : (
                            <div className="space-y-3 text-sm">
                                {processes.map((proc) => (
                                    <div key={proc.pid}>
                                        <p>
                                            <strong>Process:</strong> ({proc.pid}) {proc.name}
                                        </p>
                                        <p>
                                            <strong>Parent:</strong> {proc.ppid}
                                        </p>
                                        <p>
                                            <strong>Memory:</strong> {proc.memory?.toFixed(2) ?? '--'}MB
                                        </p>
                                        <p>
                                            <strong>CPU:</strong> {proc.cpu?.toFixed(2) ?? '--'}%
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Report Modal */}
            <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Send Diagnostics Data</DialogTitle>
                        <DialogDescription>Submit diagnostics data to the support team.</DialogDescription>
                    </DialogHeader>

                    {reportState === 'info' && (
                        <div className="space-y-3 text-sm">
                            <p>
                                This <em>optional</em> feature sends a diagnostics report to the fxPanel/Cfx.re teams,
                                and may be required to diagnose a wide range of server issues. After sending the data,
                                you will receive a Report ID you can send in the support channels.
                            </p>
                            <div>
                                <strong>Which data will be sent?</strong>
                                <ul className="mt-1 list-inside list-disc space-y-0.5">
                                    <li>All diagnostics page data</li>
                                    <li>Recent fxPanel (system), live console and server log</li>
                                    <li>Environment variables</li>
                                    <li>Server performance (dashboard chart) data</li>
                                    <li>Player database statistics</li>
                                    <li>fxPanel settings (no bot token)</li>
                                    <li>List of admins (no passwords/hashes)</li>
                                    <li>List of files/folders in server data and monitor folders</li>
                                    <li>Config files in server data folder</li>
                                </ul>
                            </div>
                            <div>
                                <strong>Sensitive Information Protection:</strong>
                                <ul className="mt-1 list-inside list-disc space-y-0.5">
                                    <li>
                                        <strong>Settings:</strong> the Discord Bot Token will be removed
                                    </li>
                                    <li>
                                        <strong>Admin List:</strong> the password hashes will not be sent
                                    </li>
                                    <li>
                                        <strong>Env Vars:</strong> parameters with key, license, pass, private, secret,
                                        token in their name will be masked.
                                    </li>
                                    <li>
                                        <strong>CFG Files:</strong> known secret parameters will be masked.
                                    </li>
                                    <li>
                                        <strong>Logs:</strong> any identifiable IPv4 address in logs will be masked.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {reportState === 'loading' && (
                        <div className="flex min-h-32 items-center justify-center">
                            <Loader2Icon className="h-8 w-8 animate-spin" />
                        </div>
                    )}

                    {reportState === 'success' && (
                        <div className="text-center">
                            <h2 className="text-xl">
                                Report ID:{' '}
                                <code className="bg-secondary rounded px-3 py-1 text-2xl tracking-widest">
                                    {reportId}
                                </code>
                            </h2>
                        </div>
                    )}

                    {reportState === 'error' && (
                        <div className="text-center">
                            <h4 className="text-destructive">{reportError}</h4>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setReportModalOpen(false)}>
                            Close
                        </Button>
                        {reportState === 'info' && (
                            <Button variant="default" onClick={handleSendReport}>
                                Agree & Send Data
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
