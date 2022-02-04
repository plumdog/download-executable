import { fetchExecutable, Options } from '.';

export const kubectl = async (targetPath: string, version: string): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        options: Options.version({
            url: 'https://dl.k8s.io/release/v{version}/bin/{platform}/amd64/kubectl',
            version,
            versionExecArgs: ['version', '--client=true', '--short'],
            versionExecPostProcess: (execOutput: string): string => {
                const prefix = 'Client Version: v';
                if (!execOutput.startsWith(prefix)) {
                    throw new Error('Unexpected output from kubectl version');
                }
                return execOutput.substring(prefix.length).trim();
            },
        }),
    });
};

export const sops = async (targetPath: string, version: string): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        options: Options.version({
            url: 'https://github.com/mozilla/sops/releases/download/v{version}/sops-v{version}.{platform}',
            version,
            versionExecArgs: ['--version'],
            versionExecPostProcess: (execOutput: string): string => {
                const firstLine = execOutput.trim().split('\n')[0];
                const prefix = 'sops ';
                if (!firstLine.startsWith(prefix)) {
                    throw new Error('Unexpected output from sops version');
                }
                return firstLine.substring(prefix.length).trim().replace(/ .*/, '');
            },
        }),
    });
};

export const helmfile = async (targetPath: string, version: string): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        options: Options.version({
            url: 'https://github.com/roboll/helmfile/releases/download/v{version}/helmfile_{platform}_amd64',
            version,
            versionExecArgs: ['--version'],
            versionExecPostProcess: (execOutput: string): string => {
                const prefix = 'helmfile version v';
                if (!execOutput.startsWith(prefix)) {
                    throw new Error('Unexpected output from helmfile version');
                }
                return execOutput.substring(prefix.length).trim();
            },
        }),
    });
};
