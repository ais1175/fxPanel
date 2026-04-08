import { useRef, useState } from 'react';
import { useBackendApi } from '@/hooks/fetch';
import { txToast } from '@/components/txToaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2Icon } from 'lucide-react';
import useSWR from 'swr';

type AdvancedDataResp = {
    verbosityEnabled: boolean;
};

type AdvancedActionResp = {
    type?: string;
    message?: string;
    refresh?: boolean;
    error?: string;
};

export default function AdvancedPage() {
    const magicInputRef = useRef<HTMLInputElement>(null);
    const [magicOutput, setMagicOutput] = useState('What will happen when its pressed?!');
    const [isRunning, setIsRunning] = useState(false);

    const dataApi = useBackendApi<AdvancedDataResp>({
        method: 'GET',
        path: '/advanced/data',
    });

    const actionApi = useBackendApi<AdvancedActionResp>({
        method: 'POST',
        path: '/advanced',
    });

    const swrDataFetcher = async () => {
        let resp: AdvancedDataResp | undefined;
        await dataApi({
            success(data) {
                resp = data;
            },
        });
        return resp;
    };

    const { data, mutate } = useSWR('/advanced/data', swrDataFetcher);

    const handleAction = (action: string, parameter: any = false, onSuccess?: (d: AdvancedActionResp) => void) => {
        setIsRunning(true);
        actionApi({
            data: { action, parameter },
            toastLoadingMessage: 'Executing...',
            genericHandler: {
                successMsg: 'Done.',
            },
            success(respData) {
                setIsRunning(false);
                if (respData.refresh) {
                    mutate();
                    txToast.success('Done. Page refreshed.');
                    return;
                }
                if (onSuccess) {
                    onSuccess(respData);
                } else if (respData.type && respData.message) {
                    const toastType = respData.type as 'success' | 'warning' | 'error' | 'info';
                    txToast[toastType]?.(respData.message) ?? txToast.default(respData.message);
                }
            },
            error(msg) {
                setIsRunning(false);
                txToast.error(msg);
            },
        });
    };

    return (
        <div className="mx-auto w-full max-w-(--breakpoint-lg) space-y-4 px-2 md:px-0">
            <div className="px-2 md:px-0">
                <h1 className="mb-2 text-3xl">Advanced</h1>
            </div>

            <div className="border-warning/30 bg-warning-hint rounded-lg border p-4 text-center text-sm">
                <strong>
                    This is a page exclusively for advanced users.
                    <br />
                    Do not expect any support in our Discord if you mess with something on this page.
                </strong>
                <br />
                This is also an undocumented feature for a reason: nothing here is expected to work properly and things
                might be added or removed for any reason.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Left card - Random buttons */}
                <div className="border-destructive/30 rounded-lg border p-4">
                    <h2 className="mb-4 text-lg font-bold">Random buttons, knobs and data:</h2>
                    <div className="space-y-4 text-center">
                        {/* Verbosity toggle */}
                        <div>
                            <p className="text-muted-foreground text-sm">
                                With verbosity enabled, you will see more detailed information on the terminal.
                                <br />
                                Good to help getting information on errors.
                            </p>
                            {data?.verbosityEnabled ? (
                                <Button
                                    variant="destructive"
                                    className="mt-2"
                                    disabled={isRunning}
                                    onClick={() => handleAction('change_verbosity', 'false')}
                                >
                                    {isRunning && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                                    Disable Verbosity
                                </Button>
                            ) : (
                                <Button
                                    variant="default"
                                    className="bg-success hover:bg-success/80 mt-2"
                                    disabled={isRunning}
                                    onClick={() => handleAction('change_verbosity', 'true')}
                                >
                                    {isRunning && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                                    Enable Verbosity
                                </Button>
                            )}
                        </div>

                        <hr className="border-border" />

                        {/* Profile Monitor */}
                        <div>
                            <p className="text-muted-foreground text-sm">
                                This will execute the profiler in the Monitor for 5 seconds.
                                <br />
                                Requires the Server to be started for showing the profiler URL.
                            </p>
                            <Button
                                variant="outline"
                                className="mt-2"
                                disabled={isRunning}
                                onClick={() => handleAction('profile_monitor')}
                            >
                                Profile Monitor
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Right card - Magic button */}
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Input ref={magicInputRef} defaultValue="perform_magic" className="flex-1" />
                        <Button
                            variant="outline"
                            disabled={isRunning}
                            onClick={() => {
                                const val = magicInputRef.current?.value?.trim() ?? 'perform_magic';
                                handleAction(val, false, (d) => {
                                    if (d.type === 'success') {
                                        setMagicOutput(d.message ?? '');
                                    } else if (d.message) {
                                        const toastType = d.type as 'warning' | 'error' | 'info';
                                        txToast[toastType]?.(d.message) ?? txToast.default(d.message);
                                    }
                                });
                            }}
                        >
                            Magic Button
                        </Button>
                    </div>
                    <pre className="bg-secondary text-secondary-foreground max-h-96 overflow-auto rounded-lg p-3 text-sm">
                        {magicOutput}
                    </pre>
                </div>
            </div>
        </div>
    );
}
