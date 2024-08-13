import { fetchExecutable, FetchExecutableOptions } from '.';
import { compareVersions } from 'compare-versions';

export const kubectl = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        url: 'https://dl.k8s.io/release/v{version}/bin/{platform}/{arch!x64ToAmd64}/kubectl',
        version,
        versionExecArgs: ['version', '--client=true', ...(compareVersions(version, '1.28.0') >= 0 ? [] : ['--short=true'])],
        versionExecPostProcess: (execOutput: string): string => {
            const lines = execOutput.split('\n');
            const prefix = 'Client Version: v';
            const clientVersionLines = lines.filter((line: string) => line.startsWith(prefix));
            const clientVersionLine = clientVersionLines[0];

            if (!clientVersionLine) {
                throw new Error(`Unexpected output from kubectl version, no lines started with prefix: ${prefix}`);
            }

            if (clientVersionLines.length > 1) {
                throw new Error(`Unexpected output from kubectl version, multiple lines started with prefix: ${prefix}`);
            }

            return clientVersionLine.substring(prefix.length).trim();
        },
        hashMethod: 'sha256',
        hashValueUrl: 'https://dl.k8s.io/v{version}/bin/{platform}/{arch!x64ToAmd64}/kubectl.sha256',
        ...(options ?? {}),
    });
};

export const sops = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        url: 'https://github.com/mozilla/sops/releases/download/v{version}/sops-v{version}.{platform}',
        version,
        versionExecArgs: ['--version'],
        versionExecPostProcess: (execOutput: string): string => {
            const firstLine = execOutput.trim().split('\n')[0] ?? '';
            const prefix = 'sops ';
            if (!firstLine.startsWith(prefix)) {
                throw new Error('Unexpected output from sops version');
            }
            return firstLine.substring(prefix.length).trim().replace(/ .*/, '');
        },
        ...(options ?? {}),
    });
};

export const helmfile = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
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
        ...(options ?? {}),
    });
};

export const helm = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
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
        ...(options ?? {}),
    });
};

export const eksctl = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        url: 'https://github.com/weaveworks/eksctl/releases/download/v{version}/eksctl_{platform!capitalize}_{arch!x64ToAmd64}.tar.gz',
        version,
        versionExecArgs: ['version'],
        gzExtract: true,
        pathInTar: 'eksctl',
        ...(options ?? {}),
    });
};

export const minikube = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
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
        ...(options ?? {}),
    });
};

export const gomplate = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
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
        ...(options ?? {}),
    });
};

export const mysqlsh = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        url: 'https://dev.mysql.com/get/Downloads/MySQL-Shell/mysql-shell-{version}-linux-glibc2.12-x86-64bit.tar.gz',
        version,
        versionExecArgs: ['--version'],
        versionExecPostProcess: (execOutput: string): string => {
            const matches = execOutput.match(/\d+\.\d+\.\d+/);
            if (matches) {
                return matches[0] ?? '';
            }
            throw new Error('Unexpect output from mysqlsh --version');
        },
        pathInTar: 'mysql-shell-{version}-linux-glibc2.12-x86-64bit',
        gzExtract: true,
        executableSubPathInDir: 'bin/mysqlsh',
        ...(options ?? {}),
    });
};

export const usql = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        url: 'https://github.com/xo/usql/releases/download/v{version}/usql_static-{version}-{platform}-{arch!x64ToAmd64}.tar.bz2',
        version,
        versionExecArgs: ['--version'],
        versionExecPostProcess: (execOutput: string): string => {
            const prefix = 'usql ';
            if (!execOutput.startsWith(prefix)) {
                throw new Error('Unexpected output from usql version');
            }
            return execOutput.substring(prefix.length).trim();
        },
        pathInTar: 'usql_static',
        bz2Extract: true,
        ...(options ?? {}),
    });
};

export const terraform = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        url: 'https://releases.hashicorp.com/terraform/{version}/terraform_{version}_{platform}_{arch!x64ToAmd64}.zip',
        version,
        versionExecArgs: ['version'],
        versionExecPostProcess: (execOutput: string): string => {
            const firstLine = execOutput.trim().split('\n')[0] ?? '';
            const prefix = 'Terraform v';
            if (!firstLine.startsWith(prefix)) {
                throw new Error('Unexpected output from terraform version');
            }
            return firstLine.substring(prefix.length).trim();
        },
        pathInZip: 'terraform',
        ...(options ?? {}),
    });
};

export const jq = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        url: 'https://github.com/stedolan/jq/releases/download/jq-{version}/jq-{platform}{arch!x64To64}',
        version,
        versionExecArgs: ['--version'],
        versionExecPostProcess: (execOutput: string): string => {
            const prefix = 'jq-';
            if (!execOutput.startsWith(prefix)) {
                throw new Error('Unexpected output from jq version');
            }
            return execOutput.substring(prefix.length).trim();
        },
        ...(options ?? {}),
    });
};

export const vagrant = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        url: 'https://releases.hashicorp.com/vagrant/{version}/vagrant_{version}_{platform}_{arch!x64ToAmd64}.zip',
        version,
        versionExecArgs: ['--version'],
        versionExecPostProcess: (execOutput: string): string => {
            const prefix = 'Vagrant ';
            if (!execOutput.startsWith(prefix)) {
                throw new Error('Unexpected output from vagrant version');
            }
            return execOutput.substring(prefix.length).trim();
        },
        pathInZip: 'vagrant',
        ...(options ?? {}),
    });
};

export const yq = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        url: 'https://github.com/mikefarah/yq/releases/download/v{version}/yq_{platform}_{arch!x64ToAmd64}',
        version,
        versionExecArgs: ['--version'],
        versionExecPostProcess: (execOutput: string): string => {
            const prefix = 'yq ';
            if (!execOutput.startsWith(prefix)) {
                throw new Error('Unexpected output from yq version');
            }
            return execOutput
                .substring(prefix.length)
                .trim()
                .replace(/.* version /, '')
                .trim();
        },
        ...(options ?? {}),
    });
};

export const kubent = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        url: 'https://github.com/doitintl/kube-no-trouble/releases/download/{version}/kubent-{version}-{platform}-{arch!x64ToAmd64}.tar.gz',
        version,
        versionExecArgs: ['--version'],
        versionExecCaptureStderr: true,
        versionExecPostProcess: (execOutput: string): string => {
            const matches = execOutput.match(/\d+\.\d+\.\d+/);
            if (matches) {
                return matches[0] ?? '';
            }
            throw new Error('Unexpect output from kubent --version');
        },
        pathInTar: 'kubent',
        gzExtract: true,
        ...(options ?? {}),
    });
};

export const flux = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        url: 'https://github.com/fluxcd/flux2/releases/download/v{version}/flux_{version}_{platform}_{arch!x64ToAmd64}.tar.gz',
        version,
        gzExtract: true,
        pathInTar: 'flux',
        versionExecArgs: ['--version'],
        versionExecPostProcess: (execOutput: string): string => {
            const prefix = 'flux version ';
            if (!execOutput.startsWith(prefix)) {
                throw new Error('Unexpected output from flux --version');
            }
            return execOutput.substring(prefix.length).trim();
        },
        ...(options ?? {}),
    });
};

export const gh = async (targetPath: string, version: string, options?: Partial<FetchExecutableOptions>): Promise<void> => {
    await fetchExecutable({
        target: targetPath,
        url: 'https://github.com/cli/cli/releases/download/v{version}/gh_{version}_{platform}_{arch!x64ToAmd64}.tar.gz',
        version,
        gzExtract: true,
        pathInTar: 'gh_{version}_{platform}_{arch!x64ToAmd64}/bin/gh',
        versionExecArgs: ['version'],
        versionExecPostProcess: (execOutput: string): string => {
            // Sample output:
            // gh version 2.54.0 (2024-08-01)
            // https://github.com/cli/cli/releases/tag/v2.54.0

            // Should return 2.54.0
            const firstLine = execOutput.trim().split('\n')[0] ?? '';
            const prefix = 'gh version ';
            if (!firstLine.startsWith(prefix)) {
                throw new Error('Unexpected output from gh version');
            }
            return firstLine.substring(prefix.length).trim().replace(/ .*/, '');
        },
        ...(options ?? {}),
    });
};
