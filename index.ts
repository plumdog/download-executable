import * as fs from 'fs';
import { execSync } from 'child_process';
import * as streamlib from 'stream';
import * as zlib from 'zlib';
import * as tarStream from 'tar-stream';
import * as tar from 'tar';
import * as crypto from 'crypto';
import * as pathlib from 'path';
import bz2 from 'unbzip2-stream';
import unzip from 'unzip-stream';
import format from 'string-format';
import axios from 'axios';

type ExecIsOk = (filepath: string) => Promise<boolean>;

export interface FetchExecutableMessage {
    message: string;
    kind: string;
    target: string;
    isVerbose: boolean;
}

export type FetchExecutableMessager = (message: FetchExecutableMessage) => void;

export interface FetchExecutableOptions {
    target: string;
    url: string;
    execIsOk?: ExecIsOk;
    version?: string;
    versionExecArgs?: Array<string>;
    versionExecPostProcess?: (execOutput: string) => string;
    pathInTar?: string;
    pathInZip?: string;
    executableSubPathInDir?: string;
    executableSubPathSymlink?: string;
    gzExtract?: boolean;
    bz2Extract?: boolean;
    hashMethod?: string;
    hashValueUrl?: string;
    hashChecksumFileMatchFilepath?: string;
    messager?: FetchExecutableMessager;
    messagerBuiltin?: string;
    messagerBuiltinVerbose?: boolean;
    messagerBuiltinStream?: streamlib.Writable;
}

const hashFile = (filepath: string, hashType: string): Promise<string> => {
    return new Promise((res, rej) => {
        const sum = crypto.createHash(hashType);
        const stream = fs.createReadStream(filepath);
        stream.on('error', (err) => {
            rej(err);
        });
        stream.on('data', (chunk) => {
            sum.update(chunk);
        });
        stream.on('end', () => {
            res(sum.digest('hex'));
        });
    });
};

const readFromChecksumFile = (response: string, matchFilepath: string): string => {
    for (const line of response.split('\n')) {
        const firstSpaceIndex = line.indexOf(' ');
        if (firstSpaceIndex === -1) {
            continue;
        }

        const first = line.substr(0, firstSpaceIndex).trim();
        const remaining = line.substr(firstSpaceIndex + 1).trim();

        if (remaining === matchFilepath) {
            return first;
        }
    }

    throw new Error(`Unable to find match for ${matchFilepath} in checksum file`);
};

const optionsExecIsOk = (options: FetchExecutableOptions): ExecIsOk => {
    const checks: Array<ExecIsOk> = [];

    if (options.execIsOk) {
        checks.push(options.execIsOk);
    }

    if (options.version) {
        checks.push(async (filepath: string): Promise<boolean> => {
            let out: string;
            try {
                out = execSync([filepath, ...(options.versionExecArgs ?? [])].join(' '), { encoding: 'utf8' }).trim();
            } catch (err) {
                return false;
            }
            const processed = options.versionExecPostProcess ? options.versionExecPostProcess(out) : out;
            return processed === options.version;
        });
    }

    if (options.hashValueUrl) {
        if (options.executableSubPathInDir) {
            throw new Error('Cannot use executableSubPathInDir with hashValueUrl');
        }

        const hashValueUrl = optionsFormat(options)(options.hashValueUrl);
        checks.push(async (filepath: string): Promise<boolean> => {
            const response = await axios.get(hashValueUrl);
            const hashValueUrlResponse = response.data;
            const expectedHashValue = options.hashChecksumFileMatchFilepath
                ? readFromChecksumFile(hashValueUrlResponse, optionsFormat(options)(options.hashChecksumFileMatchFilepath))
                : hashValueUrlResponse.trim();
            const actualHashValue = await hashFile(filepath, options.hashMethod ?? 'sha256');
            return expectedHashValue.trim() === actualHashValue.trim();
        });
    }

    if (checks.length === 0) {
        throw new Error('Must set one of: execIsOk; version; hashValueUrl');
    }

    return async (filepath: string): Promise<boolean> => {
        for (const check of checks) {
            if (!(await check(filepath))) {
                return false;
            }
        }

        return true;
    };
};

const fmt = format.create({
    capitalize: (str: string): string => {
        return str[0].toUpperCase() + str.slice(1);
    },
    x64ToAmd64: (str: string): string => {
        if (str === 'x64') {
            return 'amd64';
        }
        return str;
    },
});

const optionsFormat =
    (options: FetchExecutableOptions) =>
    (str: string): string => {
        return fmt(str, {
            ...(typeof options.version !== 'undefined'
                ? {
                      version: options.version,
                  }
                : {}),
            platform: process.platform,
            arch: process.arch,
        });
    };

const optionsUrl = (options: FetchExecutableOptions): string => {
    return optionsFormat(options)(options.url);
};

const saveFromStream = (stream: NodeJS.ReadableStream, dest: string): Promise<void> => {
    return new Promise((res, rej) => {
        try {
            fs.unlinkSync(dest);
        } catch (err) {
            if (err.code === 'ENOENT') {
                // That's fine
            } else {
                throw err;
            }
        }

        const output = fs.createWriteStream(dest);
        output.on('finish', () => {
            res();
        });
        output.on('error', (err) => {
            rej(err);
        });
        stream.pipe(output);
    });
};

const extractFromTar = (inStream: NodeJS.ReadableStream, pathInTar: string): NodeJS.ReadableStream => {
    const extract = tarStream.extract();

    const outStream = new streamlib.PassThrough();
    let found = false;

    extract.on('entry', (header, entryStream, next) => {
        if (header.name === pathInTar) {
            found = true;
            entryStream.pipe(outStream);
        }

        entryStream.on('end', () => {
            next();
        });

        entryStream.resume();
    });

    extract.on('finish', () => {
        if (!found) {
            throw new Error(`Failed to find ${pathInTar} in tar`);
        }
    });

    inStream.pipe(extract);

    return outStream;
};

const extractFromZip = (inStream: NodeJS.ReadableStream, pathInZip: string): NodeJS.ReadableStream => {
    const outStream = new streamlib.PassThrough();

    let found = false;

    const extract = new streamlib.Transform({
        objectMode: true,
        transform: (entry, e, callback): void => {
            if (entry.path === pathInZip && entry.type == 'File') {
                found = true;
                entry.pipe(outStream);
                entry.on('finish', callback);
            } else {
                entry.autodrain();
                callback();
            }
        },
    });

    extract.on('finish', () => {
        if (!found) {
            throw new Error(`Failed to find ${pathInZip} in zip`);
        }
    });

    inStream.pipe(unzip.Parse()).pipe(extract);

    return outStream;
};

const extractDirectoryFromTarAndSave = (inStream: NodeJS.ReadableStream, dirPathInTar: string, dest: string): Promise<void> => {
    return new Promise((res, rej) => {
        // fs.rmSync added in 14.14.0, see https://nodejs.org/api/fs.html#fsrmsyncpath-options
        /* istanbul ignore next */
        if (fs.rmSync) {
            fs.rmSync(dest, {
                recursive: true,
                force: true,
            });
        } else {
            try {
                fs.rmdirSync(dest, {
                    recursive: true,
                });
            } catch (err) {
                if (err.code === 'ENOENT') {
                    // Not there, that's fine
                } else {
                    throw err;
                }
            }
        }

        fs.mkdirSync(dest, {
            recursive: true,
        });

        let anyPathsFound = false;

        const stripCount = dirPathInTar.replace(new RegExp(`${pathlib.sep}+$`), '').split(pathlib.sep).length;
        const stream = tar.extract({
            cwd: dest,
            filter: (path: string): boolean => {
                if (path.startsWith(dirPathInTar)) {
                    anyPathsFound = true;
                    return true;
                }
                return false;
            },
            strip: stripCount,
        } as tar.ExtractOptions);

        inStream.pipe(stream);

        stream.on('finish', () => {
            if (anyPathsFound) {
                res();
            } else {
                rej(new Error(`Failed to find ${dirPathInTar} in tar`));
            }
        });

        stream.on('error', (err: Error) => {
            rej(err);
        });

        inStream.on('error', (err) => {
            rej(err);
        });
    });
};

const optionsSave = async (options: FetchExecutableOptions, stream: NodeJS.ReadableStream, dest: string): Promise<void> => {
    let processedStream = stream;

    if (options.gzExtract) {
        processedStream = processedStream.pipe(zlib.createGunzip());
    }

    if (options.bz2Extract) {
        processedStream = processedStream.pipe(bz2());
    }

    if (options.pathInTar) {
        if (options.executableSubPathInDir) {
            await extractDirectoryFromTarAndSave(processedStream, optionsFormat(options)(options.pathInTar), dest);
            if (options.executableSubPathSymlink) {
                const symlinkTarget = pathlib.relative(pathlib.dirname(options.executableSubPathSymlink), pathlib.join(dest, options.executableSubPathInDir));
                try {
                    fs.unlinkSync(options.executableSubPathSymlink);
                } catch (err) {
                    if (err.code === 'ENOENT') {
                        // That's fine
                    } else {
                        throw err;
                    }
                }
                fs.symlinkSync(symlinkTarget, options.executableSubPathSymlink);
            }
            return;
        } else {
            processedStream = extractFromTar(processedStream, optionsFormat(options)(options.pathInTar));
        }
    }

    if (options.pathInZip) {
        if (options.executableSubPathInDir) {
            throw new Error('Use of executableSubPathInDir not yet supported with pathInZip');
        } else {
            processedStream = extractFromZip(processedStream, optionsFormat(options)(options.pathInZip));
        }
    }

    await saveFromStream(processedStream, dest);
};

const optionsMessager = (options: FetchExecutableOptions): FetchExecutableMessager => {
    if (options.messager) {
        return options.messager;
    }

    const messagerBuiltinStream: streamlib.Writable = options.messagerBuiltinStream ?? process.stderr;

    if (options.messagerBuiltin === 'string') {
        return (message: FetchExecutableMessage): void => {
            if (!message.isVerbose || options.messagerBuiltinVerbose) {
                messagerBuiltinStream.write(message.message + '\n');
            }
        };
    } else if (options.messagerBuiltin === 'json') {
        return (message: FetchExecutableMessage): void => {
            if (!message.isVerbose || options.messagerBuiltinVerbose) {
                messagerBuiltinStream.write(JSON.stringify(message) + '\n');
            }
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return (message: FetchExecutableMessage): void => {
        // Null messager
    };
};

export const fetchExecutable = async (options: FetchExecutableOptions): Promise<void> => {
    const messager = optionsMessager(options);
    const execIsOkFn = optionsExecIsOk(options);

    const target = options.executableSubPathInDir ? pathlib.join(options.target, optionsFormat(options)(options.executableSubPathInDir)) : options.target;
    if (fs.existsSync(target)) {
        const isOk: boolean = await execIsOkFn(target);
        const symlinkIsOk: boolean = options.pathInTar && options.executableSubPathInDir && options.executableSubPathSymlink ? await execIsOkFn(options.executableSubPathSymlink) : true;

        if (isOk && symlinkIsOk) {
            messager({
                message: `Executable at ${target} is OK, nothing to do`,
                kind: 'executable_is_ok',
                target,
                isVerbose: false,
            });
            return Promise.resolve();
        }
    }

    const url = optionsUrl(options);

    messager({
        message: `Fetching from ${url}`,
        kind: 'fetching',
        target,
        isVerbose: true,
    });
    const start = new Date();

    const response = await axios.get(url, {
        responseType: 'stream',
    });

    messager({
        message: `Saving to ${target}`,
        kind: 'saving',
        target,
        isVerbose: true,
    });

    const contentLengthRaw: string | undefined = (response.headers && response.headers['content-length']) ?? undefined;
    const contentLength: number | undefined = contentLengthRaw ? parseInt(contentLengthRaw, 10) : undefined;

    let bytesDownloaded = 0;
    let lastPercentageReported = 0;

    if (contentLength) {
        response.data.on('data', (chunk: Buffer) => {
            bytesDownloaded += chunk.length;
            const percentage = Math.round((100 * bytesDownloaded) / contentLength);
            if (percentage > lastPercentageReported + 5) {
                messager({
                    message: `Downloading from ${url} (${percentage}%)`,
                    kind: 'fetch_progress',
                    target,
                    isVerbose: true,
                });
                lastPercentageReported = percentage;
            }
        });
    }

    await optionsSave(options, response.data, options.target);
    fs.chmodSync(target, 0o755);

    const newExecIsOk: boolean = await execIsOkFn(target);
    if (!newExecIsOk) {
        return Promise.reject(new Error(`Downloaded executable at ${target} failed check`));
    }

    const end = new Date();

    const fetchDuration = (end.getTime() - start.getTime()) / 1000;

    messager({
        message: `Fetched and saved to ${target} (${fetchDuration}s)`,
        kind: 'done',
        target,
        isVerbose: false,
    });
};
