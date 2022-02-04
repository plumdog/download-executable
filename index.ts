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

export interface OptionsProps {
    url: string;
    execIsOk: (filepath: string) => Promise<boolean>;
}

export interface OptionsByVersionProps {
    url: string;
    version: string;
    versionExecArgs: Array<string>;
    versionExecPostProcess?: (output: string) => string;
}

export class Options {
    readonly _url: string;
    readonly _execIsOk: (filepath: string) => Promise<boolean>;

    constructor(props: OptionsProps) {
        this._url = props.url;
        this._execIsOk = props.execIsOk;
    }

    get url(): string {
        return this._url;
    }

    execIsOk(filepath: string): Promise<boolean> {
        return this._execIsOk(filepath);
    }

    static version(props: OptionsByVersionProps): Options {
        return new Options({
            url: format(props.url, { version: props.version, platform: process.platform }),
            execIsOk: async (filepath: string): Promise<boolean> => {
                let out: string;
                try {
                    out = execSync([filepath, ...props.versionExecArgs].join(' '), { encoding: 'utf8' }).trim();
                } catch (err) {
                    return false;
                }
                const processed = props.versionExecPostProcess ? props.versionExecPostProcess(out) : out;
                return processed === props.version;
            },
        });
    }
}

export interface FetchExecutableProps {
    target: string;
    options: Options;
}

export const fetchExecutable = async (props: FetchExecutableProps): Promise<void> => {
    if (fs.existsSync(props.target)) {
        const isOk: boolean = await props.options.execIsOk(props.target);
        if (isOk) {
            return Promise.resolve();
        }
    }

    const url = props.options.url;

    const response = await axios.get(url, {
        responseType: 'stream',
    });

    await readFromStream(response.data, props.target);
    fs.chmodSync(props.target, 0o755);
};
