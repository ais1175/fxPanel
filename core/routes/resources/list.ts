const modulename = 'WebServer:ResourcesList';
import path from 'node:path';
import slash from 'slash';
import consoleFactory from '@lib/console';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import { SYM_SYSTEM_AUTHOR } from '@lib/symbols';
import { ResourcesListResp, ResourceGroup, ResourceItemData } from '@shared/resourcesApiTypes';
const console = consoleFactory(modulename);

//Helper functions
const isUndefined = (x: unknown): x is undefined => x === undefined;
const breakPath = (inPath: string) => slash(path.normalize(inPath)).split('/').filter(String);

const getResourceSubPath = (resPath: string): string => {
    if (resPath.indexOf('system_resources') >= 0) return 'system_resources';
    if (!path.isAbsolute(resPath)) return resPath;

    const serverDataPathArr = breakPath(`${txConfig.server.dataPath}/resources`);
    let resPathArr = breakPath(resPath);
    for (let i = 0; i < serverDataPathArr.length; i++) {
        if (isUndefined(resPathArr[i])) break;
        if (serverDataPathArr[i].toLowerCase() === resPathArr[i].toLowerCase()) {
            delete resPathArr[i];
        }
    }
    resPathArr.pop();
    resPathArr = resPathArr.filter(String);

    if (resPathArr.length) {
        return resPathArr.join('/');
    } else {
        return 'root';
    }
};

/**
 * Returns the resource list as JSON grouped by folder
 */
export default async function ResourcesList(ctx: AuthedCtx) {
    const sendTypedResp = (data: ResourcesListResp) => ctx.send(data);

    if (!txCore.fxRunner.child?.isAlive) {
        return sendTypedResp({ error: 'The server is not running.' });
    }

    //Send command request
    const cmdSuccess = txCore.fxRunner.sendCommand('txaReportResources', [], SYM_SYSTEM_AUTHOR);
    if (!cmdSuccess) {
        return sendTypedResp({ error: 'Failed to request resource list from the server.' });
    }

    //Poll for resource report (max 1s, check every 100ms)
    const result = await new Promise<ResourcesListResp>((resolve) => {
        const pollInterval = setInterval(() => {
            if (
                txCore.fxResources.resourceReport &&
                new Date().getTime() - txCore.fxResources.resourceReport.ts.getTime() <= 1000 &&
                Array.isArray(txCore.fxResources.resourceReport.resources)
            ) {
                clearInterval(pollInterval);
                clearTimeout(timeout);
                resolve(processResources(txCore.fxResources.resourceReport.resources));
            }
        }, 100);

        const timeout = setTimeout(() => {
            clearInterval(pollInterval);
            resolve({ error: 'Timed out waiting for resource list. Make sure the server is online.' });
        }, 1000);
    });

    return sendTypedResp(result);
}

function processResources(resList: any[]): ResourcesListResp {
    const resGroupMap: Record<string, ResourceItemData[]> = {};
    let startedCount = 0;
    let stoppedCount = 0;

    for (const resource of resList) {
        if (
            isUndefined(resource.name) ||
            isUndefined(resource.status) ||
            isUndefined(resource.path) ||
            resource.path === ''
        ) {
            continue;
        }
        const subPath = getResourceSubPath(resource.path);
        const resData: ResourceItemData = {
            name: resource.name,
            status: resource.status,
            path: slash(path.normalize(resource.path)),
            version: resource.version ? resource.version.trim() : '',
            author: resource.author ? resource.author.trim() : '',
            description: resource.description ? resource.description.trim() : '',
        };

        if (resource.status === 'started') {
            startedCount++;
        } else {
            stoppedCount++;
        }

        if (resGroupMap[subPath]) {
            resGroupMap[subPath].push(resData);
        } else {
            resGroupMap[subPath] = [resData];
        }
    }

    const groups: ResourceGroup[] = Object.keys(resGroupMap)
        .sort()
        .map((subPath) => ({
            subPath,
            resources: resGroupMap[subPath].sort((a, b) => a.name.localeCompare(b.name)),
        }));

    return {
        groups,
        totalResources: startedCount + stoppedCount,
        startedCount,
        stoppedCount,
    };
}
