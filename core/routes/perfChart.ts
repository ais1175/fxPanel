const modulename = 'WebServer:PerfChart';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import { SvRtLogFilteredType, SvRtPerfBoundariesType } from '@modules/Metrics/svRuntime/perfSchemas';
import { z } from 'zod';
import { DeepReadonly } from 'utility-types';
const console = consoleFactory(modulename);

//Types
export type PerfChartApiErrorResp = {
    fail_reason: string;
};
export type PerfChartApiSuccessResp = {
    boundaries: SvRtPerfBoundariesType;
    threadPerfLog: SvRtLogFilteredType;
};
export type PerfChartApiResp = DeepReadonly<PerfChartApiErrorResp | PerfChartApiSuccessResp>;

//Schema
const paramsSchema = z.object({ thread: z.string() });
const requiredMinDataAge = 30 * 60 * 1000; //30 mins

/**
 * Returns the data required to build the dashboard performance chart of a specific thread
 */
export default async function perfChart(ctx: AuthedCtx) {
    const sendTypedResp = (data: PerfChartApiResp) => ctx.send(data);

    //Validating input
    const schemaRes = paramsSchema.safeParse(ctx.request.params);
    if (!schemaRes.success) {
        return sendTypedResp({ fail_reason: 'bad_request' });
    }

    const chartData = txCore.metrics.svRuntime.getChartData(schemaRes.data.thread);
    if ('fail_reason' in chartData) {
        return sendTypedResp(chartData);
    }
    const { threadPerfLog, boundaries } = chartData;

    const oldestDataLogged = threadPerfLog.find((log) => log.type === 'data');
    if (!oldestDataLogged) {
        return sendTypedResp({
            fail_reason: 'not_enough_data',
        });
    } else if (oldestDataLogged.ts > Date.now() - requiredMinDataAge) {
        return sendTypedResp({
            fail_reason: 'not_enough_data',
        });
    }
    return sendTypedResp({
        boundaries,
        threadPerfLog,
    });
}
