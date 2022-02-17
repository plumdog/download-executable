import { fetchExecutable } from '..';
import * as tmp from 'tmp';
import * as pathlib from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { Readable } from 'stream';
import axios from 'axios';
import MockAxiosAdapter from 'axios-mock-adapter';
import * as tar from 'tar-stream';

const mockAxios = new MockAxiosAdapter(axios, {
    onNoMatch: 'throwException',
});

tmp.setGracefulCleanup();

afterEach(() => {
    mockAxios.reset();
});

const createBody = (body: string | Buffer): NodeJS.ReadableStream => {
    const buffer = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
    const readable = new Readable();
    readable._read = () => {
        // _read is required but you can noop it
    };
    readable.push(buffer);
    readable.push(null);
    return readable;
};

const streamToBuffer = (stream: NodeJS.ReadableStream): Promise<Buffer> => {
    return new Promise((res, rej): void => {
        const buffers: Array<Buffer> = [];
        stream.on('data', (data) => {
            buffers.push(data);
        });
        stream.on('error', (err) => {
            rej(err);
        });
        stream.on('end', () => {
            res(Buffer.concat(buffers));
        });
    });
};

const sha256String = (str: string): string => {
    const sum = crypto.createHash('sha256');
    sum.update(str);
    return sum.digest('hex');
};

const sampleExecutableFileContent = ['#!/bin/bash', '', 'echo 1.2.3', ''].join('\n');
const sampleExecutableFileContentSha256Hash = sha256String(sampleExecutableFileContent);

describe('fetchs', () => {
    test('can fetch file', async () => {
        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(sampleExecutableFileContent));

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            url: 'http://example.com/testexc_version_1.2.3',
            execIsOk: async (filepath: string): Promise<boolean> => fs.existsSync(filepath),
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual(sampleExecutableFileContent);
        expect(execSync(pathlib.join(dir.name, 'testexc'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('does not fetch file if already the right version', async () => {
        const dir = tmp.dirSync();

        fs.writeFileSync(pathlib.join(dir.name, 'testexc'), 'anyfile');

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            url: 'http://example.com/testexc_version_1.2.3',
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            execIsOk: async (filepath: string): Promise<boolean> => true,
        });

        expect(mockAxios.history.get).toEqual([]);

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual('anyfile');

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('does fetch file if the wrong version', async () => {
        const dir = tmp.dirSync();

        fs.writeFileSync(pathlib.join(dir.name, 'testexc'), 'oldfile');

        mockAxios.onGet().reply(200, createBody('newfile'));

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            url: 'http://example.com/testexc_version_1.2.3',
            execIsOk: async (filepath: string): Promise<boolean> => fs.readFileSync(filepath, 'utf8').trim() !== 'oldfile',
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual('newfile');

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('can fetch file from tar', async () => {
        const packTar = tar.pack();
        packTar.entry(
            {
                name: 'mydir/mysubdir/myfile.sh',
            },
            sampleExecutableFileContent,
        );
        packTar.finalize();

        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(await streamToBuffer(packTar)));

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            url: 'http://example.com/testexc_version_1.2.3.tar',
            execIsOk: async (filepath: string): Promise<boolean> => fs.existsSync(filepath),
            pathInTar: 'mydir/mysubdir/myfile.sh',
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual(sampleExecutableFileContent);

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('can fetch file from tar.gz', async () => {
        const packTar = tar.pack();
        packTar.entry(
            {
                name: 'mydir/mysubdir/myfile.sh',
            },
            sampleExecutableFileContent,
        );
        packTar.finalize();

        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(zlib.gzipSync(await streamToBuffer(packTar))));

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            url: 'http://example.com/testexc_version_1.2.3.tar',
            execIsOk: async (filepath: string): Promise<boolean> => fs.existsSync(filepath),
            pathInTar: 'mydir/mysubdir/myfile.sh',
            gzExtract: true,
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual(sampleExecutableFileContent);

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('can fetch directory from tar', async () => {
        const packTar = tar.pack();
        packTar.entry(
            {
                name: 'mydir/testexc/main.sh',
            },
            ['#!/bin/bash', '', 'SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"', '', 'cat "$SCRIPT_DIR"/version.txt'].join('\n'),
        );
        packTar.entry(
            {
                name: 'mydir/testexc/version.txt',
            },
            '1.2.3',
        );
        packTar.finalize();

        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(await streamToBuffer(packTar)));

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            url: 'http://example.com/testexc_version_1.2.3.tar',
            execIsOk: async (filepath: string): Promise<boolean> => fs.existsSync(filepath),
            pathInTar: 'mydir/testexc/',
            executableSubPathInDir: 'main.sh',
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc', 'version.txt'), 'utf8').trim()).toEqual('1.2.3');

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('can fetch directory from tar with symlink', async () => {
        const packTar = tar.pack();
        packTar.entry(
            {
                name: 'mydir/testexc/main.sh',
            },
            ['#!/bin/bash', '', 'SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"', '', 'cat "$SCRIPT_DIR"/version.txt'].join('\n'),
        );
        packTar.entry(
            {
                name: 'mydir/testexc/version.txt',
            },
            '1.2.3',
        );
        packTar.finalize();

        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(await streamToBuffer(packTar)));

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc_dir'),
            url: 'http://example.com/testexc_version_1.2.3.tar',
            execIsOk: async (filepath: string): Promise<boolean> => fs.existsSync(filepath),
            pathInTar: 'mydir/testexc/',
            executableSubPathInDir: 'main.sh',
            executableSubPathSymlink: pathlib.join(dir.name, 'testexc.sh'),
        });

        expect(execSync(pathlib.join(dir.name, 'testexc.sh'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');
        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('does not fetch directory from tar if already exists', async () => {
        const dir = tmp.dirSync();

        fs.mkdirSync(pathlib.join(dir.name, 'testexc'));
        fs.writeFileSync(pathlib.join(dir.name, 'testexc', 'main.sh'), ['#!/bin/bash', '', 'SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"', '', 'cat "$SCRIPT_DIR"/version.txt'].join('\n'), 'utf8');
        fs.chmodSync(pathlib.join(dir.name, 'testexc', 'main.sh'), 0o775);
        fs.writeFileSync(pathlib.join(dir.name, 'testexc', 'version.txt'), '1.2.3', 'utf8');

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            url: 'http://example.com/testexc_version_1.2.3.tar',
            execIsOk: async (filepath: string): Promise<boolean> => fs.existsSync(filepath),
            pathInTar: 'mydir/testexc/',
            executableSubPathInDir: 'main.sh',
        });

        expect(mockAxios.history.get).toEqual([]);
        expect(execSync(pathlib.join(dir.name, 'testexc', 'main.sh'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');
        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('handles if target for directory from tar exists but is a file', async () => {
        const packTar = tar.pack();
        packTar.entry(
            {
                name: 'mydir/testexc/main.sh',
            },
            ['#!/bin/bash', '', 'SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"', '', 'cat "$SCRIPT_DIR"/version.txt'].join('\n'),
        );
        packTar.entry(
            {
                name: 'mydir/testexc/version.txt',
            },
            '1.2.3',
        );
        packTar.finalize();

        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(await streamToBuffer(packTar)));

        fs.writeFileSync(pathlib.join(dir.name, 'testexc'), 'a file, not a directory, should be deleted', 'utf8');

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            url: 'http://example.com/testexc_version_1.2.3.tar',
            execIsOk: async (filepath: string): Promise<boolean> => fs.existsSync(filepath),
            pathInTar: 'mydir/testexc/',
            executableSubPathInDir: 'main.sh',
        });

        expect(mockAxios.history.get.length).toEqual(1);
        expect(execSync(pathlib.join(dir.name, 'testexc', 'main.sh'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');
        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('does not fetch directory from tar if already exists with symlink', async () => {
        const dir = tmp.dirSync();

        fs.mkdirSync(pathlib.join(dir.name, 'testexc_dir'));
        fs.writeFileSync(
            pathlib.join(dir.name, 'testexc_dir', 'main.sh'),
            ['#!/bin/bash', '', 'SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"', '', 'cat "$SCRIPT_DIR"/version.txt'].join('\n'),
            'utf8',
        );
        fs.chmodSync(pathlib.join(dir.name, 'testexc_dir', 'main.sh'), 0o775);
        fs.writeFileSync(pathlib.join(dir.name, 'testexc_dir', 'version.txt'), '1.2.3', 'utf8');
        fs.symlinkSync(pathlib.join('./', 'testexc_dir', 'main.sh'), pathlib.join(dir.name, 'testexc.sh'));

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc_dir'),
            url: 'http://example.com/testexc_version_1.2.3.tar',
            execIsOk: async (filepath: string): Promise<boolean> => fs.existsSync(filepath),
            pathInTar: 'mydir/testexc/',
            executableSubPathInDir: 'main.sh',
            executableSubPathSymlink: pathlib.join(dir.name, 'testexc.sh'),
        });

        expect(mockAxios.history.get).toEqual([]);
        expect(execSync(pathlib.join(dir.name, 'testexc_dir', 'main.sh'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');
        expect(execSync(pathlib.join(dir.name, 'testexc.sh'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');
        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('does fetch directory from tar if already exists but missing symlink', async () => {
        const packTar = tar.pack();
        packTar.entry(
            {
                name: 'mydir/testexc/main.sh',
            },
            ['#!/bin/bash', '', 'SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"', '', 'cat "$SCRIPT_DIR"/version.txt'].join('\n'),
        );
        packTar.entry(
            {
                name: 'mydir/testexc/version.txt',
            },
            '1.2.3',
        );
        packTar.finalize();

        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(await streamToBuffer(packTar)));

        fs.mkdirSync(pathlib.join(dir.name, 'testexc_dir'));
        fs.writeFileSync(
            pathlib.join(dir.name, 'testexc_dir', 'main.sh'),
            ['#!/bin/bash', '', 'SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"', '', 'cat "$SCRIPT_DIR"/version.txt'].join('\n'),
            'utf8',
        );
        fs.chmodSync(pathlib.join(dir.name, 'testexc_dir', 'main.sh'), 0o775);
        fs.writeFileSync(pathlib.join(dir.name, 'testexc_dir', 'version.txt'), '1.2.3', 'utf8');
        // No symlink

        // But executable itself OK
        expect(execSync(pathlib.join(dir.name, 'testexc_dir', 'main.sh'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc_dir'),
            url: 'http://example.com/testexc_version_1.2.3.tar',
            execIsOk: async (filepath: string): Promise<boolean> => fs.existsSync(filepath),
            pathInTar: 'mydir/testexc/',
            executableSubPathInDir: 'main.sh',
            // But symlink wanted
            executableSubPathSymlink: pathlib.join(dir.name, 'testexc.sh'),
        });

        expect(mockAxios.history.get.length).toEqual(1);
        expect(execSync(pathlib.join(dir.name, 'testexc_dir', 'main.sh'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');
        // Symlink now exists and works
        expect(execSync(pathlib.join(dir.name, 'testexc.sh'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');
        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('fails if path not in directory from tar', async () => {
        const packTar = tar.pack();
        packTar.entry(
            {
                name: 'mydir/testexc/main.sh',
            },
            ['#!/bin/bash', '', 'SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"', '', 'cat "$SCRIPT_DIR"/version.txt'].join('\n'),
        );
        packTar.entry(
            {
                name: 'mydir/testexc/version.txt',
            },
            '1.2.3',
        );
        packTar.finalize();

        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(await streamToBuffer(packTar)));

        await expect(
            fetchExecutable({
                target: pathlib.join(dir.name, 'testexc'),
                url: 'http://example.com/testexc_version_1.2.3.tar',
                execIsOk: async (filepath: string): Promise<boolean> => fs.existsSync(filepath),
                pathInTar: 'mydir/doesnotexist/',
                executableSubPathInDir: 'main.sh',
            }),
        ).rejects.toEqual(new Error('Failed to find mydir/doesnotexist/ in tar'));

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('can bz2Extract file', async () => {
        // Result of running:
        // (echo '#!/bin/bash'; echo; echo 'echo 1.2.3') | bzip2 | base64 -w 0
        const bz2SampleExecutableFileContent = 'QlpoOTFBWSZTWd/+5C4AAALZgAAQaAG4ADphiAAgADFNMjExMQiNAekyPSQFOVDEBkh08JOJM/F3JFOFCQ3/7kLg';

        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(Buffer.from(bz2SampleExecutableFileContent, 'base64')));

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            url: 'http://example.com/testexc_version_1.2.3.bz2',
            execIsOk: async (filepath: string): Promise<boolean> => fs.existsSync(filepath),
            bz2Extract: true,
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual(sampleExecutableFileContent);

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('rejects if fetched file fails version check', async () => {
        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(sampleExecutableFileContent));

        expect.assertions(1);

        await expect(
            fetchExecutable({
                target: pathlib.join(dir.name, 'testexc'),
                url: 'http://example.com/testexc_version_1.2.3',
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                execIsOk: async (filepath: string): Promise<boolean> => false,
            }),
        ).rejects.toEqual(new Error(`Downloaded executable at ${dir.name}/testexc failed check`));

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('fetches if local file fails hash check', async () => {
        const dir = tmp.dirSync();

        const target = pathlib.join(dir.name, 'testexc');
        fs.writeFileSync(target, [sampleExecutableFileContent, '', '# extra'].join('\n'));
        fs.chmodSync(target, 0o755);

        mockAxios.onGet('http://example.com/testexc_version_1.2.3').reply(200, createBody(sampleExecutableFileContent));
        mockAxios.onGet('http://example.com/testexc_version_1.2.3_sha256').reply(200, sampleExecutableFileContentSha256Hash);

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            version: '1.2.3',
            url: 'http://example.com/testexc_version_{version}',
            hashValueUrl: 'http://example.com/testexc_version_{version}_sha256',
        });

        // expect(mockAxios.history.get).toEqual([]);

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual(sampleExecutableFileContent);

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('fetches if local file fails hash check using checksum file', async () => {
        const dir = tmp.dirSync();

        const target = pathlib.join(dir.name, 'testexc');
        fs.writeFileSync(target, [sampleExecutableFileContent, '', '# extra'].join('\n'));
        fs.chmodSync(target, 0o755);

        mockAxios.onGet('http://example.com/testexc_version_1.2.3').reply(200, createBody(sampleExecutableFileContent));
        mockAxios.onGet('http://example.com/testexc_version_1.2.3_sha256').reply(200, [`${sampleExecutableFileContentSha256Hash} testexc`, 'otherhash otherfile'].join('\n'));

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            version: '1.2.3',
            url: 'http://example.com/testexc_version_{version}',
            hashValueUrl: 'http://example.com/testexc_version_{version}_sha256',
            hashChecksumFileMatchFilepath: 'testexc',
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual(sampleExecutableFileContent);

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('rejects if no way to check version', async () => {
        const dir = tmp.dirSync();

        await expect(
            fetchExecutable({
                target: pathlib.join(dir.name, 'testexc'),
                url: 'http://example.com/testexc_version_1.2.3',
            }),
        ).rejects.toEqual(new Error('Must set one of: execIsOk; version; hashValueUrl'));

        fs.rmdirSync(dir.name, { recursive: true });
    });
});

describe('fetchs using version shortcut', () => {
    test('can fetch file by version shortcut', async () => {
        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(sampleExecutableFileContent));

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            version: '1.2.3',
            url: 'http://example.com/testexc_version_{version}',
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual(sampleExecutableFileContent);
        expect(execSync(pathlib.join(dir.name, 'testexc'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');

        expect(mockAxios.history.get[0].url).toEqual('http://example.com/testexc_version_1.2.3');

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('does not fetch file if already the right version', async () => {
        const dir = tmp.dirSync();

        const target = pathlib.join(dir.name, 'testexc');
        fs.writeFileSync(target, sampleExecutableFileContent);
        fs.chmodSync(target, 0o755);

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            version: '1.2.3',
            url: 'http://example.com/testexc_version_{version}',
        });

        expect(mockAxios.history.get).toEqual([]);

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual(sampleExecutableFileContent);

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('does fetch file if unable to run local executable', async () => {
        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(sampleExecutableFileContent));

        const target = pathlib.join(dir.name, 'testexc');
        fs.writeFileSync(target, sampleExecutableFileContent);
        // No execute
        fs.chmodSync(target, 0o644);

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            version: '1.2.3',
            url: 'http://example.com/testexc_version_{version}',
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual(sampleExecutableFileContent);
        expect(execSync(pathlib.join(dir.name, 'testexc'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');

        expect(mockAxios.history.get[0].url).toEqual('http://example.com/testexc_version_1.2.3');

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('does not fetch file if already the right version, handle post-process', async () => {
        const dir = tmp.dirSync();

        const content = ['#!/bin/bash', '', 'echo prefix 1.2.3 suffix', ''].join('\n');

        const target = pathlib.join(dir.name, 'testexc');
        fs.writeFileSync(target, content);
        fs.chmodSync(target, 0o755);

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            version: '1.2.3',
            url: 'http://example.com/testexc_version_{version}',
            versionExecPostProcess: (output: string): string => {
                return output.replace(/^prefix\ /, '').replace(/\ suffix$/, '');
            },
        });

        expect(mockAxios.history.get).toEqual([]);

        fs.rmdirSync(dir.name, { recursive: true });
    });
});
