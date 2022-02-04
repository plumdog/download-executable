import { fetchExecutable } from '..';
import * as tmp from 'tmp';
import * as pathlib from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

tmp.setGracefulCleanup();

const sampleExecutableFileContent = ['#!/bin/bash', '', 'echo 1.2.3', ''].join('\n');

const base64encode = (str: string): string => {
    return Buffer.from(str).toString('base64');
};

describe('httpbin', () => {
    test('get from httpbin', async () => {
        const dir = tmp.dirSync();

        const options = {
            url: `https://httpbin.org/base64/${base64encode(sampleExecutableFileContent)}`,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            execIsOk: async (filepath: string): Promise<boolean> => false,
        };

        await fetchExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            options,
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual(sampleExecutableFileContent);
        expect(execSync(pathlib.join(dir.name, 'testexc'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');

        fs.rmdirSync(dir.name, { recursive: true });
    });
});
