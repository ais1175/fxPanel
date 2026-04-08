import { useState } from 'react';
import { AdminListItem, AdminStatsEntry } from '@shared/adminApiTypes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    PencilIcon,
    TrashIcon,
    ShieldCheckIcon,
    KeyIcon,
    MessageSquareIcon,
    RotateCcwIcon,
    MoreVerticalIcon,
    BarChart3Icon,
} from 'lucide-react';
import AdminStatsDialog from './AdminStatsDialog';

type AdminListCardProps = {
    admin: AdminListItem;
    stats?: AdminStatsEntry;
    actionsRank?: number;
    canManage: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onResetPassword: () => void;
    selectMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
};

export default function AdminListCard({
    admin,
    stats,
    actionsRank,
    canManage,
    onEdit,
    onDelete,
    onResetPassword,
    selectMode,
    isSelected,
    onToggleSelect,
}: AdminListCardProps) {
    const [showStats, setShowStats] = useState(false);

    const permLabel = admin.isMaster
        ? 'Master Account'
        : admin.permissions.includes('all_permissions')
          ? 'All Permissions'
          : `${admin.permissions.length} permission${admin.permissions.length !== 1 ? 's' : ''}`;

    const showManageActions = canManage && !admin.isYou && !admin.isMaster;
    const showMenu = !selectMode;
    const canSelect = selectMode && !admin.isMaster && !admin.isYou;

    return (
        <Card
            className={cn(
                'flex flex-col transition-colors',
                selectMode && canSelect && 'cursor-pointer',
                isSelected && 'ring-primary ring-2',
            )}
            onClick={canSelect ? onToggleSelect : undefined}
        >
            <CardContent className="space-y-2 pt-4 pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                        {selectMode ? (
                            canSelect ? (
                                <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={onToggleSelect}
                                    className="shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <div className="w-4" />
                            )
                        ) : (
                            <div
                                className={cn(
                                    'h-2.5 w-2.5 shrink-0 rounded-full',
                                    admin.isOnline ? 'bg-green-500' : 'bg-muted-foreground/30',
                                )}
                                title={admin.isOnline ? 'Online (in-game)' : 'Offline'}
                            />
                        )}
                        <span className="truncate text-base font-semibold">{admin.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {admin.isYou && (
                            <Badge variant="secondary" className="text-xs">
                                You
                            </Badge>
                        )}
                        {admin.isMaster && (
                            <Badge variant="secondary" className="text-xs">
                                Master
                            </Badge>
                        )}
                        {showMenu && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                        <MoreVerticalIcon className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setShowStats(true)} className="gap-2">
                                        <BarChart3Icon className="h-3.5 w-3.5" />
                                        Stats
                                    </DropdownMenuItem>
                                    {showManageActions && (
                                        <>
                                            <DropdownMenuItem onClick={onEdit} className="gap-2">
                                                <PencilIcon className="h-3.5 w-3.5" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={onResetPassword} className="gap-2">
                                                <RotateCcwIcon className="h-3.5 w-3.5" />
                                                Reset Password
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={onDelete}
                                                className="text-destructive focus:text-destructive gap-2"
                                            >
                                                <TrashIcon className="h-3.5 w-3.5" />
                                                Delete
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

                <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <ShieldCheckIcon className="h-3.5 w-3.5" />
                    {permLabel}
                </div>

                <div className="flex flex-wrap gap-2">
                    {admin.hasCitizenFx && (
                        <Badge variant="outline" className="gap-1 text-xs">
                            <KeyIcon className="h-3 w-3" />
                            Cfx.re
                        </Badge>
                    )}
                    {admin.hasDiscord && (
                        <Badge variant="outline" className="gap-1 text-xs">
                            <MessageSquareIcon className="h-3 w-3" />
                            Discord
                        </Badge>
                    )}
                </div>
            </CardContent>

            {/* Stats modal */}
            <AdminStatsDialog
                open={showStats}
                onOpenChange={setShowStats}
                adminName={admin.name}
                stats={stats}
                actionsRank={actionsRank}
            />
        </Card>
    );
}
