import fs from 'node:fs';
import path from 'node:path';
import { SemVer } from 'semver';
import config from './config';

/**
 * txAdmin in ASCII
 */
export const txAdminASCII = () => {
    //NOTE: precalculating the ascii art for efficiency
    // const figlet = require('figlet');
    // let ascii = figlet.textSync('txAdmin');
    // let b64 = Buffer.from(ascii).toString('base64');
    // console.log(b64);
    const preCalculated = `ICBfICAgICAgICAgICAgXyAgICAgICBfICAgICAgICAgICBfICAgICAgIAogfCB8X19fICBfX
 yAgIC8gXCAgIF9ffCB8XyBfXyBfX18gKF8pXyBfXyAgCiB8IF9fXCBcLyAvICAvIF8gXCAvIF9gIHwgJ18gYCBfIFx8IHwg
 J18gXCAKIHwgfF8gPiAgPCAgLyBfX18gXCAoX3wgfCB8IHwgfCB8IHwgfCB8IHwgfAogIFxfXy9fL1xfXC9fLyAgIFxfXF9
 fLF98X3wgfF98IHxffF98X3wgfF98CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA=`;
    return Buffer.from(preCalculated, 'base64').toString('ascii');
};

/**
 * txAdmin + license banner for bundled files
 */
export const licenseBanner = (baseDir = '.', isBundledFile = false) => {
    const licensePath = path.join(baseDir, 'LICENSE');
    const rootPrefix = isBundledFile ? '../' : '';
    const lineSep = '%'.repeat(80);
    const logoPad = ' '.repeat(18);
    const contentLines = [
        lineSep,
        ...txAdminASCII()
            .split('\n')
            .map((x) => logoPad + x),
        lineSep,
        'Author: André Tabarra (https://github.com/tabarra)',
        'Author: SomeAussieGaymer (https://github.com/SomeAussieGaymer)',
        'Repository: https://github.com/SomeAussieGaymer/fxpanel',
        'fxPanel is a free open source software provided under the license below.',
        lineSep,
        ...fs.readFileSync(licensePath, 'utf8').trim().split('\n'),
        lineSep,
        'This distribution also includes third party code under their own licenses, which',
        `can be found in ${rootPrefix}THIRD-PARTY-LICENSES.txt or their respective repositories.`,
        `Attribution for non-code assets can be found at the bottom of ${rootPrefix}docs/README.md or at`,
        'the top of the respective file.',
        lineSep,
    ];
    if (isBundledFile) {
        const flattened = contentLines.join('\n * ');
        return `/*!\n * ${flattened}\n */`;
    } else {
        return contentLines.join('\n');
    }
};

/**
 * Processes a fxserver path to validate it as well as the monitor folder.
 * NOTE: this function is windows only, but could be easily adapted.
 */
export const getFxsPaths = (fxserverPath: string) => {
    const root = path.normalize(fxserverPath);

    //Process fxserver path
    const bin = path.join(root, 'FXServer.exe');
    const binStat = fs.statSync(bin);
    if (!binStat.isFile()) {
        throw new Error(`${bin} is not a file.`);
    }

    //Process monitor path
    const monitor = path.join(root, 'citizen', 'system_resources', 'monitor');
    const monitorStat = fs.statSync(monitor);
    if (!monitorStat.isDirectory()) {
        throw new Error(`${monitor} is not a directory.`);
    }

    return { root, bin, monitor };
};

/**
 * Extracts the version from the GITHUB_REF env var and detects if pre-release
 * NOTE: to run locally: `GITHUB_REF="refs/tags/v9.9.9" npm run build`
 */
export const getPublishVersion = (isOptional: boolean) => {
    const workflowRef = process.env.GITHUB_REF;
    try {
        if (!workflowRef) {
            if (isOptional) {
                return {
                    txVersion: '0.1.0-Beta',
                    isPreRelease: false,
                    preReleaseExpiration: '0',
                };
            } else {
                throw new Error('No --tag found.');
            }
        }
        const refRemoved = workflowRef.replace(/^(refs\/tags\/)?v/, '');
        const parsedVersion = new SemVer(refRemoved);
        const isPreRelease = parsedVersion.prerelease.length > 0;
        const potentialExpiration = new Date().setUTCHours(24 * config.preReleaseExpirationDays, 0, 0, 0);
        console.log(`fxPanel version ${parsedVersion.version}.`);
        return {
            txVersion: parsedVersion.version,
            isPreRelease,
            preReleaseExpiration: process.env.TX_NO_EXPIRATION
                ? '0'
                : isPreRelease
                  ? potentialExpiration.toString()
                  : '0',
        };
    } catch (error) {
        console.error('Version setup failed: ' + error.message);
        process.exit(1);
    }
};

/**
 * Formats a lua table of strings for fxmanifest script sections.
 */
const formatLuaSection = (name: string, scripts: string[]) => {
    const items = scripts.map((s) => `    '${s}',`).join('\n');
    return `${name}({\n${items}\n})`;
};

/**
 * Edits the ./monitor/fxmanifest.lua to include the txAdmin version
 * and auto-generate script lists from the resource directory.
 */
const setupDistFxmanifest = (targetPath: string, txVersion: string) => {
    const fxManifestPath = path.join(targetPath, 'fxmanifest.lua');
    let fxManifestContent = fs.readFileSync(fxManifestPath, 'utf8');
    fxManifestContent = fxManifestContent.replace(/^version 'REPLACE-VERSION'$/m, `version '${txVersion}'`);

    // Auto-generate script lists using fs.globSync (Node 22+)
    const findScripts = (pattern: string) =>
        fs
            .globSync(pattern, { cwd: targetPath })
            .map((f) => f.replaceAll('\\', '/'))
            .sort();

    const sharedScripts = findScripts('resource/shared*.lua');

    // Server scripts: entrypoint.js first, then sv_main.lua, then rest sorted
    const serverLuaScripts = findScripts('resource/**/sv_*.lua');
    const svMainIdx = serverLuaScripts.findIndex((f) => f === 'resource/sv_main.lua');
    if (svMainIdx > 0) {
        const [svMain] = serverLuaScripts.splice(svMainIdx, 1);
        serverLuaScripts.unshift(svMain);
    }
    const serverScripts = ['entrypoint.js', ...serverLuaScripts];

    // Client scripts: cl_* scripts first, then vendor scripts
    // cl_main.lua must load first (defines RegisterSecureNuiCallback, etc.)
    // cl_ptfx.lua must load before cl_player_mode.lua
    // vendor scripts must be ordered: utils → config → main → camera
    const clientLuaScripts = findScripts('resource/**/cl_*.lua');
    const clMainIdx = clientLuaScripts.findIndex((f) => f === 'resource/cl_main.lua');
    if (clMainIdx > 0) {
        const [clMain] = clientLuaScripts.splice(clMainIdx, 1);
        clientLuaScripts.unshift(clMain);
    }
    const vendorOrder = ['utils.lua', 'config.lua', 'main.lua', 'camera.lua'];
    const vendorScripts = findScripts('resource/menu/vendor/**/*.lua').sort((a, b) => {
        const aName = a.split('/').pop() ?? '';
        const bName = b.split('/').pop() ?? '';
        const aIdx = vendorOrder.indexOf(aName);
        const bIdx = vendorOrder.indexOf(bName);
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
    });
    const clientScripts = [...clientLuaScripts, ...vendorScripts];
    const ptfxIdx = clientScripts.findIndex((f) => f.includes('cl_ptfx.lua'));
    const playerModeIdx = clientScripts.findIndex((f) => f.includes('cl_player_mode.lua'));
    if (ptfxIdx > playerModeIdx && playerModeIdx >= 0) {
        const [ptfx] = clientScripts.splice(ptfxIdx, 1);
        clientScripts.splice(playerModeIdx, 0, ptfx);
    }

    // Replace script sections in manifest
    const sectionRegex = (name: string) => new RegExp(`${name}\\(\\{[\\s\\S]*?\\}\\)`);
    fxManifestContent = fxManifestContent.replace(
        sectionRegex('shared_scripts'),
        formatLuaSection('shared_scripts', sharedScripts),
    );
    fxManifestContent = fxManifestContent.replace(
        sectionRegex('server_scripts'),
        formatLuaSection('server_scripts', serverScripts),
    );
    fxManifestContent = fxManifestContent.replace(
        sectionRegex('client_scripts'),
        formatLuaSection('client_scripts', clientScripts),
    );

    fs.writeFileSync(fxManifestPath, fxManifestContent);
};

/**
 * Sync the files from local path to target path.
 * This function tried to remove the files before copying new ones,
 * therefore, first make sure the path is correct.
 * NOTE: each change, it resets the entire target path.
 */
export const copyStaticFiles = (targetPath: string, txVersion: string, eventName: string) => {
    console.log(`[COPIER][${eventName}] Syncing ${targetPath}.`);
    let failures = 0;
    for (const srcPath of config.copy) {
        const destPath = path.join(targetPath, srcPath);
        try {
            fs.rmSync(destPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
        } catch (error) {
            console.warn(
                `[COPIER] Failed to remove ${destPath}: ${(error as Error).message}, copying over existing files.`,
            );
        }
        try {
            fs.cpSync(srcPath, destPath, { recursive: true, force: true });
        } catch (error) {
            failures++;
            console.error(`[COPIER] Failed to copy ${srcPath} → ${destPath}: ${(error as Error).message}`);
        }
    }
    try {
        setupDistFxmanifest(targetPath, txVersion);
    } catch (error) {
        failures++;
        console.error(`[COPIER] Failed to setup fxmanifest: ${(error as Error).message}`);
    }
    if (failures) {
        console.warn(`[COPIER] Completed with ${failures} error(s).`);
    }
};
