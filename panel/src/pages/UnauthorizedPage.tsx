import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ShieldAlertIcon } from 'lucide-react';
import { Link } from 'wouter';

function PermissionTooltip({ permission }: { permission: string }) {
    return (
        <Tooltip>
            <TooltipTrigger className="cursor-help tracking-wider underline decoration-dotted">
                permission
            </TooltipTrigger>
            <TooltipContent>{permission}</TooltipContent>
        </Tooltip>
    );
}

type UnauthorizedPageProps = {
    pageName: string;
    permission: string;
};

export default function UnauthorizedPage({ pageName, permission }: UnauthorizedPageProps) {
    let messageNode;
    if (permission === 'master') {
        messageNode = (
            <>
                You need to be the Master account to view the <strong className="text-accent">{pageName}</strong> page.
            </>
        );
    } else {
        messageNode = (
            <>
                You don't have the required <PermissionTooltip permission={permission} /> to view the{' '}
                <strong className="text-accent">{pageName}</strong> page. <br />
                Please contact your server owner if you believe this is an error.
            </>
        );
    }
    return (
        <div className="bg-background flex w-full items-start justify-center px-4 pt-[7.5vh]">
            <div className="border-destructive/50 bg-destructive-hint/15 mx-auto max-w-xl space-y-4 rounded-lg border p-6 text-center">
                <h1 className="text-destructive text-2xl font-bold tracking-tight">
                    <ShieldAlertIcon className="mt-0.5 mr-2 inline size-6 align-text-top" />
                    Access Denied
                </h1>
                <p className="text-primary/90 mt-4 text-sm tracking-wide">{messageNode}</p>
                <Button variant="outline" size="sm" asChild>
                    <Link href="/">Return to Dashboard</Link>
                </Button>
            </div>
        </div>
    );
}
