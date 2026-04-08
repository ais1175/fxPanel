const modulename = 'WebServer:TopLevelMw';
import { txEnv } from '@core/globalData';
import { AppError } from '@lib/errors';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);
import { Next } from 'koa';
import { RawKoaCtx } from '../ctxTypes';

//Token Bucket (Rate Limiter)
const maxTokens = 20;
const tokensPerInterval = 5;
let availableTokens = maxTokens;
let suppressedErrors = 0;
setInterval(() => {
    availableTokens = Math.min(availableTokens + tokensPerInterval, maxTokens);
    if (suppressedErrors) {
        console.warn(`Suppressed ${suppressedErrors} errors to prevent log spam.`);
        suppressedErrors = 0;
    }
}, 5_000);
const consumePrintToken = () => {
    if (availableTokens > 0) {
        availableTokens--;
        return true;
    }
    suppressedErrors++;
    return false;
};

//Consts
const timeoutLimit = 47 * 1000; //REQ_TIMEOUT_REALLY_REALLY_LONG is 45s

/**
 * Middleware responsible for timeout/error/no-output/413
 */
const topLevelMw = async (ctx: RawKoaCtx, next: Next) => {
    ctx.set('Server', `fxPanel v${txEnv.txaVersion}`);
    let timerId;
    const timeout = new Promise((_, reject) => {
        timerId = setTimeout(() => {
            reject(new Error('route_timed_out'));
        }, timeoutLimit);
    });
    try {
        await Promise.race([timeout, next()]);
        if (typeof ctx.body == 'undefined' || (typeof ctx.body == 'string' && !ctx.body.length)) {
            console.verbose.warn(`Route without output: ${ctx.path}`);
            return (ctx.body = '[no output from route]');
        }
    } catch (e) {
        const error = e as Error; //this has all been previously validated
        const prefix = `[fxPanel v${txEnv.txaVersion}]`;
        const reqPath = ctx.path.length > 80 ? `${ctx.path.slice(0, 77)}...` : ctx.path;
        const methodName = error.stack && error.stack[0] && error.stack[0].name ? error.stack[0].name : 'anonym';

        //NOTE: I couldn't force xss on path message, but just in case I'm forcing it here
        //but it is overwritten by koa when we set the body to an object, which is fine
        ctx.type = 'text/plain';
        ctx.set('X-Content-Type-Options', 'nosniff');

        //AppError — intentional, structured error thrown from routes
        if (error instanceof AppError) {
            ctx.status = error.httpStatus;
            ctx.body = { error: error.message };
            if (error.httpStatus >= 500 && consumePrintToken()) {
                console.error(`${prefix} AppError ${error.httpStatus}: ${error.message} | ${reqPath}`, methodName);
            }

            //NOTE: not using HTTP logger endpoint anymore, FD3 only
        } else if (error.type === 'entity.too.large') {
            const desc = `Entity too large for: ${reqPath}`;
            ctx.status = 413;
            ctx.body = { error: desc };
            if (consumePrintToken()) console.verbose.error(desc, methodName);
        } else if (error.type === 'stream.not.readable') {
            const desc = `Stream Not Readable: ${reqPath}`;
            ctx.status = 422; //"Unprocessable Entity" kinda matches
            ctx.body = { error: desc };
            if (consumePrintToken()) console.verbose.warn(desc, methodName);
        } else if (error.message === 'route_timed_out') {
            const desc = `Route timed out: ${reqPath}`;
            ctx.status = 408;
            ctx.body = { error: desc };
            if (consumePrintToken()) console.error(`${prefix} ${desc}`, methodName);
        } else if (error.message === 'Malicious Path' || error.message === 'failed to decode') {
            const desc = `Malicious Path: ${reqPath}`;
            ctx.status = 406;
            ctx.body = { error: desc };
            if (consumePrintToken()) console.verbose.error(`${prefix} ${desc}`, methodName);
        } else if (error.message.startsWith('Unexpected token')) {
            const desc = `Invalid JSON for: ${reqPath}`;
            ctx.status = 400;
            ctx.body = { error: desc };
            if (consumePrintToken()) console.verbose.error(`${prefix} ${desc}`, methodName);
        } else {
            ctx.status = 500;
            ctx.body = { error: 'Internal server error.' };
            if (consumePrintToken()) {
                console.error(`${prefix} Internal Error | Route: ${reqPath} | Message: ${error.message}`, methodName);
                console.verbose.dir(error);
            }
        }
    } finally {
        //Cannot forget about this or the ctx will only be released from memory after the timeout,
        //making it easier to crash the server in a DDoS attack
        clearTimeout(timerId);
    }
};

export default topLevelMw;
