import { PageHeader } from '@/components/page-header';
import { BlocksIcon } from 'lucide-react';
import AddonsContent from '@/pages/AddonsPage';

export default function AddonsManagerPage() {
    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <PageHeader
                icon={<BlocksIcon />}
                title="Addon Manager"
                description="Manage addon approvals, lifecycle, logs, and settings"
            />
            <AddonsContent />
        </div>
    );
}
