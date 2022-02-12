import { fetchExecutable } from '.';

export const kubectl = async (targetPath: string, version: string): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        options: {
            url: 'https://dl.k8s.io/release/v{version}/bin/{platform}/{arch!x64ToAmd64}/kubectl',
            version,
            versionExecArgs: ['version', '--client=true', '--short'],
            versionExecPostProcess: (execOutput: string): string => {
                const prefix = 'Client Version: v';
                if (!execOutput.startsWith(prefix)) {
                    throw new Error('Unexpected output from kubectl version');
                }
                return execOutput.substring(prefix.length).trim();
            },
            hashMethod: 'sha256',
            hashValueUrl: 'https://dl.k8s.io/v{version}/bin/{platform}/{arch!x64ToAmd64}/kubectl.sha256',
        },
    });
};

export const sops = async (targetPath: string, version: string): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        options: {
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
        },
    });
};

export const helmfile = async (targetPath: string, version: string): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        options: {
            url: 'https://github.com/roboll/helmfile/releases/download/v{version}/helmfile_{platform}_{arch!x64ToAmd64}',
            version,
            versionExecArgs: ['--version'],
            versionExecPostProcess: (execOutput: string): string => {
                const prefix = 'helmfile version v';
                if (!execOutput.startsWith(prefix)) {
                    throw new Error('Unexpected output from helmfile version');
                }
                return execOutput.substring(prefix.length).trim();
            },
        },
    });
};

export const helm = async (targetPath: string, version: string): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        options: {
            url: 'https://get.helm.sh/helm-v{version}-{platform}-{arch!x64ToAmd64}.tar.gz',
            version,
            versionExecArgs: ['version', '--short'],
            versionExecPostProcess: (execOutput: string): string => {
                const prefix = 'v';
                if (!execOutput.startsWith(prefix)) {
                    throw new Error('Unexpected output from helm version');
                }
                return execOutput.substring(prefix.length).trim().replace(/\+.*$/, '');
            },
            gzExtract: true,
            pathInTar: '{platform}-{arch!x64ToAmd64}/helm',
        },
    });
};

export const eksctl = async (targetPath: string, version: string): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        options: {
            url: 'https://github.com/weaveworks/eksctl/releases/download/v{version}/eksctl_{platform!capitalize}_{arch!x64ToAmd64}.tar.gz',
            version,
            versionExecArgs: ['version'],
            gzExtract: true,
            pathInTar: 'eksctl',
        },
    });
};

export const minikube = async (targetPath: string, version: string): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        options: {
            url: 'https://storage.googleapis.com/minikube/releases/v{version}/minikube-{platform}-{arch!x64ToAmd64}',
            version,
            versionExecArgs: ['version', '--short'],
            versionExecPostProcess: (execOutput: string): string => {
                const prefix = 'v';
                if (!execOutput.startsWith(prefix)) {
                    throw new Error('Unexpected output from minikube version');
                }
                return execOutput.substring(prefix.length).trim();
            },
            hashValueUrl: 'https://github.com/kubernetes/minikube/releases/download/v{version}/minikube-{platform}-{arch!x64ToAmd64}.sha256',
        },
    });
};

export const gomplate = async (targetPath: string, version: string): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        options: {
            url: 'https://github.com/hairyhenderson/gomplate/releases/download/v{version}/gomplate_{platform}-{arch!x64ToAmd64}',
            version,
            versionExecArgs: ['--version'],
            versionExecPostProcess: (execOutput: string): string => {
                const prefix = 'gomplate version ';
                if (!execOutput.startsWith(prefix)) {
                    throw new Error('Unexpected output from gomplate version');
                }
                return execOutput.substring(prefix.length).trim();
            },
            hashValueUrl: 'https://github.com/hairyhenderson/gomplate/releases/download/v{version}/checksums-v{version}_sha256.txt',
            hashMethod: 'sha256',
            hashChecksumFileMatchFilepath: 'bin/gomplate_{platform}-{arch!x64ToAmd64}',
        },
    });
};
