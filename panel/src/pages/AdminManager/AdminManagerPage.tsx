import { useAdminPerms } from '@/hooks/auth';
import { useBackendApi } from '@/hooks/fetch';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Loader2Icon, PlusIcon, ShieldIcon, UsersIcon, CheckSquareIcon } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    AdminListItem,
    ApiGetAdminListResp,
    ApiAdminDeleteResp,
    ApiAdminDeleteReq,
    ApiAdminSaveResp,
    ApiAdminSaveReq,
    ApiGetAdminStatsResp,
    AdminStatsEntry,
} from '@shared/adminApiTypes';
import { ApiGetPresetsResp, ApiSavePresetsReq, ApiSavePresetsResp } from '@shared/adminApiTypes';
import { PermissionPreset } from '@shared/permissions';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { Button } from '@/components/ui/button';
import { txToast } from '@/components/txToaster';
import AdminEditDialog, { type AdminAutofillData } from './AdminEditDialog';
import AdminListCard from './AdminListCard';
import PresetsTab from './PresetsTab';
import PermissionsEditor from './PermissionsEditor';
import { emsg } from '@shared/emsg';

export default function AdminManagerPage() {
    const { hasPerm, isMaster } = useAdminPerms();
    const canManage = hasPerm('manage.admins');

    const [activeTab, setActiveTab] = useState('admins');
    const [editTarget, setEditTarget] = useState<AdminListItem | 'new' | null>(null);
    const [autofillData, setAutofillData] = useState<AdminAutofillData | undefined>();
    const [resetPasswordResult, setResetPasswordResult] = useState<{ name: string; password: string } | null>(null);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedAdmins, setSelectedAdmins] = useState<Set<string>>(new Set());
    const [isBulkApplying, setIsBulkApplying] = useState(false);
    const [showBulkPermDialog, setShowBulkPermDialog] = useState(false);
    const [bulkPermissions, setBulkPermissions] = useState<string[]>([]);
    const openConfirmDialog = useOpenConfirmDialog();

    // Auto-open add dialog when navigated with autofill params (from "Give Admin" button)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('autofill') === 'true') {
            const data: AdminAutofillData = {
                name: params.get('name') ?? '',
                citizenfxId: params.get('citizenfx') ?? '',
                discordId: (params.get('discord') ?? '').replace('discord:', ''),
            };
            setAutofillData(data);
            setEditTarget('new');
            // Clean up URL params
            const url = new URL(window.location.href);
            url.search = '';
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    // ── Admin list ──
    const listApi = useBackendApi<ApiGetAdminListResp>({
        method: 'GET',
        path: '/adminManager/list',
        throwGenericErrors: true,
    });
    const deleteApi = useBackendApi<ApiAdminDeleteResp, ApiAdminDeleteReq>({
        method: 'POST',
        path: '/adminManager/delete',
        throwGenericErrors: true,
    });
    const resetPasswordApi = useBackendApi<ApiAdminSaveResp, { name: string }>({
        method: 'POST',
        path: '/adminManager/resetPassword',
        throwGenericErrors: true,
    });
    const bulkEditApi = useBackendApi<ApiAdminSaveResp, ApiAdminSaveReq>({
        method: 'POST',
        path: '/adminManager/edit',
        throwGenericErrors: true,
    });

    const adminsSwr = useSWR('/adminManager/list', async () => {
        const data = await listApi({});
        if (!data) throw new Error('empty response');
        return data.admins;
    });

    // ── Admin stats ──
    const statsQueryApi = useBackendApi<ApiGetAdminStatsResp>({
        method: 'GET',
        path: '/adminManager/stats',
        throwGenericErrors: true,
    });
    const statsSwr = useSWR('/adminManager/stats', async () => {
        const data = await statsQueryApi({});
        if (!data || 'error' in data) return {};
        return data.stats;
    });
    const adminStats: Record<string, AdminStatsEntry> = statsSwr.data ?? {};

    // Compute activity rank (sorted by totalActions, highest first)
    const adminActivityRanks = useMemo(() => {
        const entries = Object.entries(adminStats)
            .filter(([, s]) => s.totalActions > 0)
            .sort(([, a], [, b]) => b.totalActions - a.totalActions);
        const ranks: Record<string, number> = {};
        for (let i = 0; i < entries.length; i++) {
            ranks[entries[i][0]] = i + 1;
        }
        return ranks;
    }, [adminStats]);

    // ── Presets ──
    const presetsQueryApi = useBackendApi<ApiGetPresetsResp>({
        method: 'GET',
        path: '/adminManager/presets',
        throwGenericErrors: true,
    });
    const presetsSaveApi = useBackendApi<ApiSavePresetsResp, ApiSavePresetsReq>({
        method: 'POST',
        path: '/adminManager/presets',
        throwGenericErrors: true,
    });

    const presetsSwr = useSWR('/adminManager/presets', async () => {
        const data = await presetsQueryApi({});
        if (!data) throw new Error('empty response');
        return data.presets;
    });

    const allPresets: PermissionPreset[] = presetsSwr.data ?? [];

    const handleDeleteAdmin = (admin: AdminListItem) => {
        openConfirmDialog({
            title: 'Delete Admin',
            message: `Are you sure you want to delete "${admin.name}"?`,
            onConfirm: async () => {
                await deleteApi({ data: { name: admin.name } });
                adminsSwr.mutate();
            },
        });
    };

    const handleResetPassword = (admin: AdminListItem) => {
        openConfirmDialog({
            title: 'Reset Password',
            message: `Are you sure you want to reset the password for "${admin.name}"? They will be given a temporary password and forced to change it on next login.`,
            actionLabel: 'Reset Password',
            confirmBtnVariant: 'destructive',
            onConfirm: async () => {
                try {
                    const resp = await resetPasswordApi({ data: { name: admin.name } });
                    if (!resp) return;
                    if (resp.type === 'showPassword' && resp.password) {
                        setResetPasswordResult({ name: admin.name, password: resp.password });
                    } else if (resp.type === 'danger') {
                        txToast.error({ title: 'Error', msg: resp.message });
                    }
                } catch (error) {
                    txToast.error({ title: 'Error', msg: emsg(error) });
                }
            },
        });
    };

    const handleSavePresets = async (presets: PermissionPreset[]) => {
        await presetsSaveApi({ data: { presets } });
        presetsSwr.mutate();
    };

    const toggleSelectMode = () => {
        setSelectMode(!selectMode);
        setSelectedAdmins(new Set());
    };

    const toggleAdminSelection = (name: string) => {
        setSelectedAdmins((prev) => {
            const next = new Set(prev);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    const openBulkPermDialog = () => {
        if (selectedAdmins.size === 0) {
            txToast.error({ title: 'Error', msg: 'Select at least one admin first.' });
            return;
        }
        setBulkPermissions([]);
        setShowBulkPermDialog(true);
    };

    const handleBulkApply = async () => {
        const targets = adminsSwr.data?.filter((a) => selectedAdmins.has(a.name) && !a.isMaster && !a.isYou) ?? [];
        if (targets.length === 0) {
            txToast.error({ title: 'Error', msg: 'No eligible admins selected.' });
            return;
        }
        if (bulkPermissions.length === 0) {
            txToast.error({ title: 'Error', msg: 'Select at least one permission to apply.' });
            return;
        }

        setShowBulkPermDialog(false);
        setIsBulkApplying(true);
        try {
            let successCount = 0;
            for (const admin of targets) {
                try {
                    await bulkEditApi({
                        data: {
                            name: admin.name,
                            citizenfxId: '',
                            discordId: '',
                            permissions: [...bulkPermissions],
                        },
                    });
                    successCount++;
                } catch (_) {
                    /* continue */
                }
            }
            txToast.success(`Applied permissions to ${successCount} admin${successCount !== 1 ? 's' : ''}.`);
            adminsSwr.mutate();
            setSelectMode(false);
            setSelectedAdmins(new Set());
        } finally {
            setIsBulkApplying(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Admin Manager</h1>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="admins" className="gap-1.5">
                        <UsersIcon className="h-4 w-4" />
                        Admins
                    </TabsTrigger>
                    <TabsTrigger value="presets" className="gap-1.5">
                        <ShieldIcon className="h-4 w-4" />
                        Permission Presets
                    </TabsTrigger>
                </TabsList>

                {/* ── Admins tab ── */}
                <TabsContent value="admins" className="mt-4">
                    <div className="flex flex-col gap-3">
                        {canManage && (
                            <div className="flex items-center justify-between gap-2">
                                {selectMode ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-muted-foreground text-sm">
                                            {selectedAdmins.size} selected
                                        </span>
                                        <Button
                                            variant="outline"
                                            className="gap-1.5"
                                            onClick={openBulkPermDialog}
                                            disabled={selectedAdmins.size === 0 || isBulkApplying}
                                        >
                                            Apply Permissions
                                        </Button>
                                        <Button variant="outline" className="gap-1.5" onClick={toggleSelectMode}>
                                            Cancel
                                        </Button>
                                    </div>
                                ) : (
                                    <div />
                                )}
                                <div className="flex items-center gap-2">
                                    {!selectMode && (
                                        <Button variant="outline" className="gap-1.5" onClick={toggleSelectMode}>
                                            <CheckSquareIcon className="h-4 w-4" />
                                            Bulk Apply
                                        </Button>
                                    )}
                                    <Button variant="outline" className="gap-1.5" onClick={() => setEditTarget('new')}>
                                        <PlusIcon className="h-4 w-4" />
                                        Add Admin
                                    </Button>
                                </div>
                            </div>
                        )}

                        {adminsSwr.isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2Icon className="text-muted-foreground h-8 w-8 animate-spin" />
                            </div>
                        ) : adminsSwr.error ? (
                            <p className="text-destructive py-8 text-center">Failed to load admin list.</p>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {adminsSwr.data?.map((admin) => (
                                    <AdminListCard
                                        key={admin.name}
                                        admin={admin}
                                        stats={adminStats[admin.name]}
                                        actionsRank={adminActivityRanks[admin.name]}
                                        canManage={canManage}
                                        onEdit={() => setEditTarget(admin)}
                                        onDelete={() => handleDeleteAdmin(admin)}
                                        onResetPassword={() => handleResetPassword(admin)}
                                        selectMode={selectMode}
                                        isSelected={selectedAdmins.has(admin.name)}
                                        onToggleSelect={() => toggleAdminSelection(admin.name)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ── Presets tab ── */}
                <TabsContent value="presets" className="mt-4">
                    <PresetsTab
                        presets={presetsSwr.data ?? []}
                        isLoading={presetsSwr.isLoading}
                        canManage={canManage}
                        onSave={handleSavePresets}
                    />
                </TabsContent>
            </Tabs>

            {/* ── Add / Edit dialog ── */}
            {editTarget !== null && (
                <AdminEditDialog
                    target={editTarget}
                    allPresets={allPresets}
                    initialData={editTarget === 'new' ? autofillData : undefined}
                    onClose={() => {
                        setEditTarget(null);
                        setAutofillData(undefined);
                    }}
                    onSaved={() => {
                        setEditTarget(null);
                        setAutofillData(undefined);
                        adminsSwr.mutate();
                    }}
                />
            )}

            {/* ── Reset Password result dialog ── */}
            {resetPasswordResult && (
                <Dialog open onOpenChange={() => setResetPasswordResult(null)}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Password Reset</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <p className="text-muted-foreground text-sm">
                                The password for <strong>{resetPasswordResult.name}</strong> has been reset. They will
                                be asked to change it on their next login.
                            </p>
                            <div className="bg-muted rounded-md p-3 text-center font-mono text-sm select-all">
                                {resetPasswordResult.password}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={() => setResetPasswordResult(null)}>Done</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* ── Bulk Apply Permissions dialog ── */}
            {showBulkPermDialog && (
                <Dialog open onOpenChange={() => setShowBulkPermDialog(false)}>
                    <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
                        <DialogHeader>
                            <DialogTitle>Bulk Apply Permissions</DialogTitle>
                            <DialogDescription>
                                Choose the permissions to apply to {selectedAdmins.size} selected admin
                                {selectedAdmins.size !== 1 ? 's' : ''}. This will replace their current permissions.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
                            <PermissionsEditor selected={bulkPermissions} onChange={setBulkPermissions} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowBulkPermDialog(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleBulkApply} disabled={bulkPermissions.length === 0 || isBulkApplying}>
                                {isBulkApplying && <Loader2Icon className="mr-1.5 h-4 w-4 animate-spin" />}
                                Apply to {selectedAdmins.size} Admin{selectedAdmins.size !== 1 ? 's' : ''}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
