import axios from 'axios';
import format from 'string-format';
import { execSync } from 'child_process';
import * as fs from 'fs';

const readFromStream = (stream: NodeJS.ReadableStream, dest: string): Promise<void> => {
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

type ExecIsOk = (filepath: string) => Promise<boolean>;

export interface Options {
    url: string;
    execIsOk?: ExecIsOk;
    version?: string;
    versionExecArgs?: Array<string>;
    versionExecPostProcess?: (execOutput: string) => string;
}

const optsExecIsOk = (opts: Options): ExecIsOk => {
    if (opts.execIsOk) {
        return opts.execIsOk;
    }
    if (opts.version) {
        return async (filepath: string): Promise<boolean> => {
            let out: string;
            try {
                out = execSync([filepath, ...(opts.versionExecArgs ?? [])].join(' '), { encoding: 'utf8' }).trim();
            } catch (err) {
                return false;
            }
            const processed = opts.versionExecPostProcess ? opts.versionExecPostProcess(out) : out;
            return processed === opts.version;
        };
    }

    throw new Error('Must set execIsOk or version');
};

const optsUrl = (opts: Options): string => {
    return format(opts.url, {
        ...(typeof opts.version !== 'undefined'
            ? {
                  version: opts.version,
              }
            : {}),
        platform: process.platform,
    });
};

export interface FetchExecutableProps {
    target: string;
    options: Options;
}

export const fetchExecutable = async (props: FetchExecutableProps): Promise<void> => {
    if (fs.existsSync(props.target)) {
        const execIsOkFn = optsExecIsOk(props.options);
        const isOk: boolean = await execIsOkFn(props.target);
        if (isOk) {
            return Promise.resolve();
        }
    }

    const url = optsUrl(props.options);

    const response = await axios.get(url, {
        responseType: 'stream',
    });

    await readFromStream(response.data, props.target);
    fs.chmodSync(props.target, 0o755);
};
