const modulename = 'RecipeEngine';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import StreamZip from 'node-stream-zip';
import { escapeRegExp } from 'lodash-es';
import mysql from 'mysql2/promise';
import got from 'got';
import consoleFactory from '@lib/console';
import { outputFile, movePath } from '@lib/fs';
import type { RecipeTask, DeployerContext, RecipeEngineMap } from './recipeTypes';
const console = consoleFactory(modulename);

//=============================================================
//== Path helper functions
//=============================================================
const safePath = (base: string, suffix: string) => {
    const safeSuffix = path.normalize(suffix).replace(/^(\.\.(\/|\\|$))+/, '');
    const resolved = path.resolve(base, safeSuffix);
    const normalizedBase = path.resolve(base);
    if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
        throw new Error(`Path traversal blocked: "${suffix}" escapes base directory`);
    }
    return resolved;
};

const isPathLinear = (pathInput: string) => {
    return pathInput.match(/(\.\.(\/|\\|$))+/g) === null;
};

const isPathRoot = (pathInput: string) => {
    return /^\.[/\\]*$/.test(pathInput);
};

const pathCleanTrail = (pathInput: string) => {
    return pathInput.replace(/[/\\]+$/, '');
};

const isPathValid = (pathInput: unknown, acceptRoot = true): pathInput is string => {
    return (
        typeof pathInput === 'string' &&
        pathInput.length > 0 &&
        isPathLinear(pathInput) &&
        (acceptRoot || !isPathRoot(pathInput))
    );
};

const replaceVars = (inputString: string, ctx: DeployerContext) => {
    const keys = Object.keys(ctx).filter((k) => k !== 'dbConnection' && k !== '$step');
    if (!keys.length) return inputString;
    const pattern = new RegExp(keys.map((k) => escapeRegExp(`{{${k}}}`)).join('|'), 'g');
    return inputString.replace(pattern, (match) => {
        const varName = match.slice(2, -2);
        return String(ctx[varName]);
    });
};

//=============================================================
//== download_file
//=============================================================
const validatorDownloadFile = (task: RecipeTask) => {
    return typeof task.url === 'string' && isPathValid(task.path);
};

const taskDownloadFile = async (task: RecipeTask, basePath: string, ctx: DeployerContext) => {
    if (!validatorDownloadFile(task)) throw new Error('invalid options');
    if ((task.path as string).endsWith('/')) throw new Error('target filename not specified');

    const destPath = safePath(basePath, task.path as string);
    await outputFile(destPath, 'file save attempt, please ignore or remove');

    ctx.$step = 'before stream';
    const gotOptions = {
        timeout: { request: 150e3 },
        retry: { limit: 5 },
    };
    const gotStream = got.stream(task.url as string, gotOptions);
    gotStream.on('downloadProgress', (progress) => {
        ctx.$step = `downloading ${Math.round(progress.percent * 100)}%`;
    });
    await pipeline(gotStream as any, fs.createWriteStream(destPath) as any);
    ctx.$step = 'after stream';
};

//=============================================================
//== download_github
//=============================================================
const githubRepoSourceRegex = /^((https?:\/\/github\.com\/)?|@)?([\w.\-_]+)\/([\w.\-_]+).*$/;

const validatorDownloadGithub = (task: RecipeTask) => {
    return (
        typeof task.src === 'string' &&
        isPathValid(task.dest, false) &&
        (typeof task.ref === 'string' || typeof task.ref === 'undefined') &&
        (typeof task.subpath === 'string' || typeof task.subpath === 'undefined')
    );
};

const taskDownloadGithub = async (task: RecipeTask, basePath: string, ctx: DeployerContext) => {
    if (!validatorDownloadGithub(task)) throw new Error('invalid options');

    //Parse source
    ctx.$step = 'task start';
    const srcMatch = (task.src as string).match(githubRepoSourceRegex);
    if (!srcMatch || !srcMatch[3] || !srcMatch[4]) throw new Error('invalid repository');
    const repoOwner = srcMatch[3];
    const repoName = srcMatch[4];

    //Resolve git ref
    let reference: string;
    const githubHeaders: Record<string, string> = {};
    if (ctx.$githubToken) {
        githubHeaders['Authorization'] = `Bearer ${ctx.$githubToken}`;
    }
    if (task.ref) {
        reference = task.ref as string;
    } else {
        const data = await got
            .get(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
                timeout: { request: 15e3 },
                headers: githubHeaders,
            })
            .json<{ default_branch?: string }>();
        if (typeof data !== 'object' || !data.default_branch) {
            throw new Error("reference not set, and was not able to detect using github's api");
        }
        reference = data.default_branch;
    }
    ctx.$step = 'ref set';

    //Prepare paths
    const downURL = `https://api.github.com/repos/${repoOwner}/${repoName}/zipball/${reference}`;
    const tmpFilePath = path.join(basePath, `.${(Date.now() % 100000000).toString(36)}.download`);
    const destPath = safePath(basePath, task.dest as string);

    //Download
    ctx.$step = 'before stream';
    const gotOptions = {
        timeout: { request: 150e3 },
        retry: { limit: 5 },
        headers: githubHeaders,
    };
    const gotStream = got.stream(downURL, gotOptions);
    gotStream.on('downloadProgress', (progress) => {
        ctx.$step = `downloading ${Math.round(progress.percent * 100)}%`;
    });
    await pipeline(gotStream as any, fs.createWriteStream(tmpFilePath) as any);
    ctx.$step = 'after stream';

    //Extract
    const zip = new StreamZip.async({ file: tmpFilePath });
    const entries = Object.values(await zip.entries());
    if (!entries.length || !entries[0].isDirectory) throw new Error('unexpected zip structure');
    const zipSubPath = path.posix.join(entries[0].name, (task.subpath as string) || '');
    ctx.$step = 'zip parsed';
    await fsp.mkdir(destPath, { recursive: true });
    ctx.$step = 'dest path created';
    await zip.extract(zipSubPath, destPath);
    ctx.$step = 'zip extracted';
    await zip.close();
    ctx.$step = 'zip closed';

    //Cleanup temp file
    await fsp.rm(tmpFilePath, { recursive: true, force: true });
    ctx.$step = 'task finished';
};

//=============================================================
//== remove_path
//=============================================================
const validatorRemovePath = (task: RecipeTask) => {
    return isPathValid(task.path, false);
};

const taskRemovePath = async (task: RecipeTask, basePath: string, _ctx: DeployerContext) => {
    if (!validatorRemovePath(task)) throw new Error('invalid options');

    const targetPath = safePath(basePath, task.path as string);
    const cleanBasePath = pathCleanTrail(path.normalize(basePath));
    if (cleanBasePath === targetPath) throw new Error('cannot remove base folder');
    await fsp.rm(targetPath, { recursive: true, force: true });
};

//=============================================================
//== ensure_dir
//=============================================================
const validatorEnsureDir = (task: RecipeTask) => {
    return isPathValid(task.path, false);
};

const taskEnsureDir = async (task: RecipeTask, basePath: string, _ctx: DeployerContext) => {
    if (!validatorEnsureDir(task)) throw new Error('invalid options');

    const destPath = safePath(basePath, task.path as string);
    await fsp.mkdir(destPath, { recursive: true });
};

//=============================================================
//== unzip
//=============================================================
const validatorUnzip = (task: RecipeTask) => {
    return isPathValid(task.src, false) && isPathValid(task.dest);
};

const taskUnzip = async (task: RecipeTask, basePath: string, _ctx: DeployerContext) => {
    if (!validatorUnzip(task)) throw new Error('invalid options');

    const srcPath = safePath(basePath, task.src as string);
    const destPath = safePath(basePath, task.dest as string);
    await fsp.mkdir(destPath, { recursive: true });

    const zip = new StreamZip.async({ file: srcPath });
    const count = await zip.extract(null, destPath);
    console.log(`Extracted ${count} entries`);
    await zip.close();
};

//=============================================================
//== move_path
//=============================================================
const validatorMovePath = (task: RecipeTask) => {
    return isPathValid(task.src, false) && isPathValid(task.dest, false);
};

const taskMovePath = async (task: RecipeTask, basePath: string, _ctx: DeployerContext) => {
    if (!validatorMovePath(task)) throw new Error('invalid options');

    const srcPath = safePath(basePath, task.src as string);
    const destPath = safePath(basePath, task.dest as string);
    await movePath(srcPath, destPath, task.overwrite === 'true' || task.overwrite === true);
};

//=============================================================
//== copy_path
//=============================================================
const validatorCopyPath = (task: RecipeTask) => {
    return isPathValid(task.src) && isPathValid(task.dest);
};

const taskCopyPath = async (task: RecipeTask, basePath: string, _ctx: DeployerContext) => {
    if (!validatorCopyPath(task)) throw new Error('invalid options');

    const srcPath = safePath(basePath, task.src as string);
    const destPath = safePath(basePath, task.dest as string);
    const cpOptions: Parameters<typeof fsp.cp>[2] = {
        recursive: true,
        force: task.overwrite === 'true' || task.overwrite === true,
    };
    if (typeof task.filter === 'string' && task.filter.length) {
        const filterGlob = task.filter;
        cpOptions!.filter = (src: string) => {
            try {
                if (fs.statSync(src).isDirectory()) return true;
            } catch {
                /* statSync may fail for broken symlinks */
            }
            return (path as any).matchesGlob(src, filterGlob);
        };
    }
    await fsp.cp(srcPath, destPath, cpOptions);
};

//=============================================================
//== write_file
//=============================================================
const validatorWriteFile = (task: RecipeTask) => {
    return typeof task.data === 'string' && task.data.length > 0 && isPathValid(task.file, false);
};

const taskWriteFile = async (task: RecipeTask, basePath: string, _ctx: DeployerContext) => {
    if (!validatorWriteFile(task)) throw new Error('invalid options');

    const filePath = safePath(basePath, task.file as string);
    if (task.append === 'true' || task.append === true) {
        await fsp.appendFile(filePath, task.data as string);
    } else {
        await outputFile(filePath, task.data as string);
    }
};

//=============================================================
//== replace_string
//=============================================================
const validatorReplaceString = (task: RecipeTask) => {
    //Validate file
    const fileList = Array.isArray(task.file) ? task.file : [task.file];
    if (fileList.some((s) => !isPathValid(s, false))) {
        return false;
    }

    //Validate mode
    if (task.mode === undefined || task.mode === 'template' || task.mode === 'literal') {
        return typeof task.search === 'string' && task.search.length > 0 && typeof task.replace === 'string';
    } else if (task.mode === 'all_vars') {
        return true;
    } else {
        return false;
    }
};

const taskReplaceString = async (task: RecipeTask, basePath: string, ctx: DeployerContext) => {
    if (!validatorReplaceString(task)) throw new Error('invalid options');

    const fileList = Array.isArray(task.file) ? (task.file as string[]) : [task.file as string];
    //Pre-compute regex and replacement value outside the file loop
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex =
        task.mode === undefined || task.mode === 'template' || task.mode === 'literal'
            ? new RegExp(
                task.mode === 'literal' ? escapeRegExp(task.search as string) : (task.search as string),
                'g',
            )
            : null;
    const replacedValue =
        task.mode === undefined || task.mode === 'template'
            ? replaceVars(task.replace as string, ctx)
            : (task.replace as string);

    await Promise.all(
        fileList.map(async (file) => {
            const filePath = safePath(basePath, file);
            const original = await fsp.readFile(filePath, 'utf8');
            let changed: string;
            if (task.mode === 'all_vars') {
                changed = replaceVars(original, ctx);
            } else if (searchRegex) {
                changed = original.replace(searchRegex, replacedValue);
            } else {
                changed = original;
            }
            await fsp.writeFile(filePath, changed);
        }),
    );
};

//=============================================================
//== connect_database
//=============================================================
const validatorConnectDatabase = (_task: RecipeTask) => {
    return true;
};

const taskConnectDatabase = async (_task: RecipeTask, _basePath: string, ctx: DeployerContext) => {
    if (typeof ctx.dbHost !== 'string') throw new Error('invalid dbHost');
    if (typeof ctx.dbPort !== 'string' && typeof (ctx as any).dbPort !== 'number') throw new Error('invalid dbPort');
    if (typeof ctx.dbUsername !== 'string') throw new Error('invalid dbUsername');
    if (typeof ctx.dbPassword !== 'string') throw new Error('dbPassword should be a string');
    if (typeof ctx.dbName !== 'string') throw new Error('dbName should be a string');
    if (typeof ctx.dbDelete !== 'string' && typeof (ctx as any).dbDelete !== 'boolean')
        throw new Error('dbDelete should be a string or boolean');

    const dbPort = typeof (ctx as any).dbPort === 'number' ? (ctx as any).dbPort : parseInt(ctx.dbPort);
    const dbDelete = (ctx as any).dbDelete === true || ctx.dbDelete === 'true';

    const mysqlOptions = {
        host: ctx.dbHost,
        port: dbPort,
        user: ctx.dbUsername,
        password: ctx.dbPassword,
        multipleStatements: true,
    };
    ctx.dbConnection = await mysql.createConnection(mysqlOptions);
    const escapedDBName = mysql.escapeId(ctx.dbName);
    if (dbDelete) {
        await ctx.dbConnection.query(`DROP DATABASE IF EXISTS ${escapedDBName}`);
    }
    await ctx.dbConnection.query(
        `CREATE DATABASE IF NOT EXISTS ${escapedDBName} CHARACTER SET utf8 COLLATE utf8_general_ci`,
    );
    await ctx.dbConnection.query(`USE ${escapedDBName}`);
};

//=============================================================
//== query_database
//=============================================================
const validatorQueryDatabase = (task: RecipeTask) => {
    if (typeof task.file !== 'undefined' && typeof task.query !== 'undefined') return false;
    if (typeof task.file === 'string') return isPathValid(task.file, false);
    if (typeof task.query === 'string') return task.query.length > 0;
    return false;
};

const taskQueryDatabase = async (task: RecipeTask, basePath: string, ctx: DeployerContext) => {
    if (!validatorQueryDatabase(task)) throw new Error('invalid options');
    if (!ctx.dbConnection) {
        throw new Error('Database connection not found. Run connect_database before query_database');
    }

    let sql: string;
    if (task.file) {
        const filePath = safePath(basePath, task.file as string);
        sql = await fsp.readFile(filePath, 'utf8');
    } else {
        sql = task.query as string;
    }
    await ctx.dbConnection.query(sql);
};

//=============================================================
//== load_vars
//=============================================================
const validatorLoadVars = (task: RecipeTask) => {
    return isPathValid(task.src, false);
};

const taskLoadVars = async (task: RecipeTask, basePath: string, ctx: DeployerContext) => {
    if (!validatorLoadVars(task)) throw new Error('invalid options');

    const srcPath = safePath(basePath, task.src as string);
    const rawData = await fsp.readFile(srcPath, 'utf8');
    const inData = JSON.parse(rawData);
    //Protect internal keys from being overwritten
    delete inData.dbConnection;
    delete inData.$step;
    Object.assign(ctx, inData);
};

//=============================================================
//== Debug tasks
//=============================================================
const validatorWasteTime = (task: RecipeTask) => {
    return typeof task.seconds === 'number';
};

const taskWasteTime = (task: RecipeTask, _basePath: string, _ctx: DeployerContext) => {
    return new Promise<void>((resolve) => {
        setTimeout(() => resolve(), (task.seconds as number) * 1000);
    });
};

const taskFailTest = async () => {
    throw new Error('test error :p');
};

const taskDumpVars = async (_task: RecipeTask, _basePath: string, ctx: DeployerContext) => {
    const toDump = { ...ctx, dbConnection: ctx.dbConnection?.constructor?.name };
    console.dir(toDump);
};

//=============================================================
//== Exports
//=============================================================
const recipeEngine: RecipeEngineMap = {
    download_file: {
        validate: validatorDownloadFile,
        run: taskDownloadFile,
        timeoutSeconds: 180,
    },
    download_github: {
        validate: validatorDownloadGithub,
        run: taskDownloadGithub,
        timeoutSeconds: 180,
    },
    remove_path: {
        validate: validatorRemovePath,
        run: taskRemovePath,
        timeoutSeconds: 15,
    },
    ensure_dir: {
        validate: validatorEnsureDir,
        run: taskEnsureDir,
        timeoutSeconds: 15,
    },
    unzip: {
        validate: validatorUnzip,
        run: taskUnzip,
        timeoutSeconds: 180,
    },
    move_path: {
        validate: validatorMovePath,
        run: taskMovePath,
        timeoutSeconds: 180,
    },
    copy_path: {
        validate: validatorCopyPath,
        run: taskCopyPath,
        timeoutSeconds: 180,
    },
    write_file: {
        validate: validatorWriteFile,
        run: taskWriteFile,
        timeoutSeconds: 15,
    },
    replace_string: {
        validate: validatorReplaceString,
        run: taskReplaceString,
        timeoutSeconds: 15,
    },
    connect_database: {
        validate: validatorConnectDatabase,
        run: taskConnectDatabase,
        timeoutSeconds: 30,
    },
    query_database: {
        validate: validatorQueryDatabase,
        run: taskQueryDatabase,
        timeoutSeconds: 90,
    },
    load_vars: {
        validate: validatorLoadVars,
        run: taskLoadVars,
        timeoutSeconds: 5,
    },

    //Debug only
    waste_time: {
        validate: validatorWasteTime,
        run: taskWasteTime,
        timeoutSeconds: 300,
    },
    fail_test: {
        validate: () => true,
        run: taskFailTest,
        timeoutSeconds: 300,
    },
    dump_vars: {
        validate: () => true,
        run: taskDumpVars,
        timeoutSeconds: 5,
    },
};

export default recipeEngine;
