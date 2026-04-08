const modulename = 'FxUpdater';
import path from 'node:path';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import stream from 'node:stream';

import { txEnv } from '@core/globalData';
import got from '@lib/got';
import consoleFactory from '@lib/console';
import quitProcess from '@lib/quitProcess';
import { emsg } from '@shared/emsg';
import type { FxUpdateStatus } from '@shared/otherTypes';
const console = consoleFactory(modulename);
const pipeline = promisify(stream.pipeline);

/**
 * Module responsible for downloading and applying FXServer artifact updates.
 * The flow is: download → extract → stop game server → swap directories → restart process.
 */
export default class FxUpdater {
    private _status: FxUpdateStatus = { phase: 'idle' };
    private readonly updateDir: string;
    private readonly archivePath: string;
    private readonly stagingDir: string;

    constructor() {
        const parentDir = path.dirname(txEnv.fxsPath);
        this.updateDir = path.join(parentDir, 'fxserver_update_temp');
        this.archivePath = path.join(this.updateDir, txEnv.isWindows ? 'server.zip' : 'fx.tar.xz');
        this.stagingDir = path.join(parentDir, 'fxserver_update_staging');
    }

    get status(): FxUpdateStatus {
        return this._status;
    }

    /**
     * Downloads the FXServer artifact from the given URL.
     */
    async download(url: string) {
        if (this._status.phase === 'downloading') {
            throw new Error('A download is already in progress.');
        }
        if (this._status.phase === 'applying') {
            throw new Error('An update is currently being applied.');
        }

        this._status = { phase: 'downloading', percentage: 0 };
        try {
            //Clean up any previous temp files
            await fsp.rm(this.updateDir, { recursive: true, force: true });
            await fsp.rm(this.stagingDir, { recursive: true, force: true });
            await fsp.mkdir(this.updateDir, { recursive: true });

            //Stream download with progress
            const gotStream = got.stream(url, {
                timeout: {
                    request: undefined,
                    lookup: 10_000,
                    connect: 10_000,
                    response: 30_000,
                },
            });
            gotStream.on('downloadProgress', (progress) => {
                this._status = {
                    phase: 'downloading',
                    percentage: Math.round(progress.percent * 100),
                };
            });
            await pipeline(gotStream, fs.createWriteStream(this.archivePath));

            //Extract to staging directory
            this._status = { phase: 'extracting' };
            await fsp.mkdir(this.stagingDir, { recursive: true });
            console.warn('Extracting artifact archive...');
            await new Promise<void>((resolve, reject) => {
                const ext = path.extname(this.archivePath).toLowerCase();
                let cmd: string;
                let args: string[];
                if (ext === '.zip') {
                    // Use PowerShell Expand-Archive on Windows for ZIP files
                    cmd = 'powershell';
                    args = [
                        '-NoProfile',
                        '-NonInteractive',
                        '-Command',
                        `Expand-Archive -Path '${this.archivePath}' -DestinationPath '${this.stagingDir}' -Force`,
                    ];
                } else {
                    cmd = 'tar';
                    args = ['-xf', this.archivePath, '-C', this.stagingDir];
                }
                const child = spawn(cmd, args, {
                    stdio: 'ignore',
                });
                child.on('error', reject);
                child.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`${cmd} exited with code ${code}`));
                });
            });

            //Verify the extraction produced something meaningful
            const files = await fsp.readdir(this.stagingDir);
            if (!files.length) {
                throw new Error('Extraction produced an empty directory.');
            }

            //Cleanup the archive
            await fsp.rm(this.updateDir, { recursive: true, force: true });

            this._status = { phase: 'extracted' };
            console.ok(`Artifact downloaded and extracted successfully.`);
        } catch (error) {
            const msg = emsg(error) ?? 'Unknown download error';
            console.error(`Artifact download failed: ${msg}`);
            this._status = { phase: 'error', message: msg };
            //Cleanup on failure
            await fsp.rm(this.updateDir, { recursive: true, force: true }).catch(() => {});
            await fsp.rm(this.stagingDir, { recursive: true, force: true }).catch(() => {});
            throw error;
        }
    }

    /**
     * Applies the downloaded update:
     * 1. Copy citizen/ from the current artifact dir into the staging dir (preserves custom txAdmin)
     *    - This works while the process is running because Windows allows reading locked files.
     * 2. Stop the game server.
     * 3. On Windows: spawn a detached batch script that waits for our PID to exit,
     *    then deletes the old artifact dir and renames the staging dir.
     *    On Linux: rename directly (inodes allow it), then exit.
     */
    async apply() {
        if (this._status.phase !== 'extracted') {
            throw new Error('No downloaded update ready to apply.');
        }

        this._status = { phase: 'applying' };
        const parentDir = path.dirname(txEnv.fxsPath);
        const artifactDirName = path.basename(txEnv.fxsPath);

        try {
            //Copy citizen/ from old artifact into staging dir (overwrite new artifact's citizen)
            const oldCitizenDir = path.join(txEnv.fxsPath, 'citizen');
            const newCitizenDir = path.join(this.stagingDir, 'citizen');
            const citizenExists = await fsp
                .access(oldCitizenDir)
                .then(() => true)
                .catch(() => false);
            if (citizenExists) {
                console.warn('Copying citizen/ from current artifacts into staging...');
                await fsp.cp(oldCitizenDir, newCitizenDir, { recursive: true, force: true });
                console.ok('citizen/ copied successfully.');
            }

            //Stop the game server if running
            if (!txCore.fxRunner.isIdle) {
                console.warn('Stopping game server for update...');
                const killError = await txCore.fxRunner.killServer('artifact update', 'fxPanel');
                if (killError) {
                    throw new Error(`Failed to stop game server: ${killError}`);
                }
            }

            if (txEnv.isWindows) {
                //Windows: spawn a batch script that waits for our PID to die,
                //then deletes the old dir and renames the staging dir.
                const toWin = (p: string) => p.replace(/\//g, '\\').replace(/\\+$/, '');
                /** Escapes a path for safe use inside a quoted batch string */
                const escapeBatchPath = (p: string) => {
                    return toWin(p)
                        .replace(/%/g, '%%') // percent signs must be doubled
                        .replace(/([\^&<>|])/g, '^$1'); // caret-escape special chars
                };
                const winFxsPath = escapeBatchPath(txEnv.fxsPath);
                const winStagingDir = escapeBatchPath(this.stagingDir);
                const winParentDir = escapeBatchPath(parentDir);
                const scriptPath = path.join(parentDir, 'fxs_update_swap.bat');
                const winScriptPath = escapeBatchPath(scriptPath);
                const pid = process.pid;

                //Capture the original command line so we can restart after swap
                let restartCmd = '';
                try {
                    const psOut = execSync(
                        `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`,
                        { encoding: 'utf8', timeout: 5000 },
                    );
                    restartCmd = psOut.trim();
                } catch {
                    console.warn('Could not capture command line for auto-restart.');
                }
                const winCwd = escapeBatchPath(process.cwd());

                const batLines = [
                    '@echo off',
                    'title FXServer Artifact Update',
                    `echo Waiting for FXServer (PID ${pid}) to exit...`,
                    ':waitloop',
                    `tasklist /FI "PID eq ${pid}" 2>NUL | find /I "${pid}" >NUL`,
                    'if not errorlevel 1 (',
                    '    timeout /t 1 /nobreak >nul',
                    '    goto waitloop',
                    ')',
                    'echo.',
                    'echo Process exited. Removing old artifacts...',
                    'set retries=0',
                    ':deleteloop',
                    `rmdir /s /q "${winFxsPath}" 2>NUL`,
                    `if exist "${winFxsPath}" (`,
                    '    set /a retries+=1',
                    '    if %retries% GEQ 10 (',
                    '        echo ERROR: Failed to delete old artifact directory after 10 attempts.',
                    '        pause',
                    '        exit /b 1',
                    '    )',
                    '    echo Waiting for directory to be released... attempt %retries%',
                    '    timeout /t 2 /nobreak >nul',
                    '    goto deleteloop',
                    ')',
                    'echo Old artifacts removed.',
                    'echo Moving new artifacts into place...',
                    `move "${winStagingDir}" "${winFxsPath}"`,
                    'if errorlevel 1 (',
                    '    echo ERROR: Failed to move staging directory.',
                    '    pause',
                    '    exit /b 1',
                    ')',
                    'echo.',
                    'echo Artifact update applied successfully!',
                ];

                if (restartCmd) {
                    batLines.push(
                        'echo Restarting FXServer...',
                        'echo.',
                        `cd /d "${winCwd}"`,
                        `start "FXServer" ${restartCmd}`,
                        'timeout /t 3 /nobreak >nul',
                    );
                } else {
                    batLines.push('echo You may now restart FXServer.', 'echo.', 'pause');
                }
                batLines.push('del "%~f0"');

                const batContent = batLines.join('\r\n');
                await fsp.writeFile(scriptPath, batContent);

                const child = spawn('cmd.exe', ['/c', `start "FXServer Update" cmd.exe /c "${winScriptPath}"`], {
                    detached: true,
                    stdio: 'ignore',
                    cwd: winParentDir,
                    shell: true,
                });
                child.unref();
                console.ok('Swap script spawned. Exiting process for update...');
            } else {
                //Linux: rename works even with open file handles
                const backupDir = path.join(parentDir, `${artifactDirName}_backup_${Date.now()}`);
                await fsp.rename(txEnv.fxsPath, backupDir);
                await fsp.rename(this.stagingDir, txEnv.fxsPath);
                console.ok('Artifact update applied. Restarting process...');
            }

            //Give a moment for logs to flush, then exit so external manager restarts us
            setTimeout(() => {
                quitProcess(0);
            }, 1500);
        } catch (error) {
            const msg = emsg(error) ?? 'Unknown apply error';
            console.error(`Artifact apply failed: ${msg}`);
            this._status = { phase: 'error', message: msg };
            throw error;
        }
    }

    /**
     * Resets the updater state (e.g. after an error).
     */
    async reset() {
        await fsp.rm(this.updateDir, { recursive: true, force: true }).catch(() => {});
        await fsp.rm(this.stagingDir, { recursive: true, force: true }).catch(() => {});
        this._status = { phase: 'idle' };
    }
}
