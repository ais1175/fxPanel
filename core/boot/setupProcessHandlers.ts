import { txDevEnv } from '@core/globalData';
import consoleFactory from '@lib/console';
const console = consoleFactory('ProcessHandlers');

export default function setupProcessHandlers() {
    //Handle any stdio error
    process.stdin.on('error', (data) => {});
    process.stdout.on('error', (data) => {});
    process.stderr.on('error', (data) => {});

    //Handling warnings (ignoring some)
    Error.stackTraceLimit = 25;
    if (!process.versions.bun) {
        process.removeAllListeners('warning');
    }
    process.on('warning', (warning) => {
        //totally ignoring the warning, we know this is bad and shouldn't happen
        if (warning.name === 'UnhandledPromiseRejectionWarning') return;

        if (warning.name !== 'ExperimentalWarning' || txDevEnv.ENABLED) {
            console.verbose.dir(warning, { multilineError: true });
        }
    });

    //Handle "the unexpected"
    process.on('unhandledRejection', (err: Error) => {
        console.error('Ohh nooooo - unhandledRejection');
        console.dir(err);
    });
    process.on('uncaughtException', function (err: Error) {
        console.error('Ohh nooooo - uncaughtException');
        console.error(err.message);
        console.dir(err.stack);
    });
}
