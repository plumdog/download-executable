# fetch-executable

Fetch an executable, but only if needed

[![GitHub license](https://img.shields.io/github/license/plumdog/fetch-executable)](https://github.com/plumdog/fetch-executable/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/fetch-executable)](https://www.npmjs.com/package/fetch-executable)
![GitHub Workflow Status (branch)](https://img.shields.io/github/workflow/status/plumdog/fetch-executable/Run%20linting%20and%20tests/main)

Intended for use downloading exact versions of executables and storing
them on a per-project basis, rather than relying on a globally stored
version being good enough for everything.

## Quickstart

```
npm i --save fetch-executable
```

Then:
```typescript
import { fetchExecutable } from 'fetch-executable';

await fetchExecutable({
    target: './my-exec',
    url: 'https://example.com/download/my-exec/{version}',
    version: '1.2.3',
    versionExecArgs: ['--version'],
});
```

This will:
- run `./my-exec --version` and check if the output is `1.2.3`
- if so, then done
- if not (because the output was the wrong version, or it errored, or the file just wasn't there)
    - download the file from `https://example.com/download/my-exec/1.2.3`
    - save it to `./my-exec`
    - make it executable
    - check it now passes the version check

## Options

### `target`

Required?: yes

Type: `string`

The target local path on disk, either absolute, or
relative to working directory.

### `url`

Required?: yes

Type: `string` (is [formatted](#string-formatting))

URL from which to download if required.

### `execIsOk`

Required?: must set one of: `execIsOk`; `version`; `hashValueUrl`

Type: `(filepath: string) => Promise<boolean>`

Given a filepath to an executable that might be the right one, return
`true` if it is, `false` if it is not. If this is set in addition to
either of `version` or `hashValueUrl`, then all tests must pass for
the local executable to be considered "ok".

### `version`

Required?: must set one of: `execIsOk`; `version`; `hashValueUrl`

Type: `string`

The desired version. Used with `versionExecArgs` to determine if the
version of a local executable is as desired. Passed to
[formatted](#string-formatting).

### `versionExecArgs`

Required?: no, defaults to `[]`. Only relevant if `version` is set.

Type: `Array<string>`

Command line arguments to pass to the local executable to make it
print its version.

### `versionExecCaptureStderr`

Required?: no, defaults capturing stdout

Type: `boolean`

If set to `true`, capture stderr from the executed command. Otherwise,
captures stdout.

### `versionExecPostProcess`

Required?: no, defaults to no post processing. Only relevant if `version` is set.

Type: `(execOutput: string) => string`

Given the string output from running the local executable (with
`versionExecArgs`), process it to return the version number for
comparison with the value set for `version`.

### `pathInTar`

Required?: no, defaults to saving the downloaded file as-is

Type: `string` (is [formatted](#string-formatting))

If set, treat the downloaded file as a `tar` archive, and extract the
file at the given path. Can be used in conjunction with `gzExtract: true` to
handle `.tar.gz` files.

### `pathInZip`

Required?: no, defaults to saving the downloaded file as-is

Type: `string` (is [formatted](#string-formatting))

If set, treat the downloaded file as a `zip` archive, and extract the
file at the given path.

### `executableSubPathInDir`

Required?: no, defaults to assuming the desired executable is a file
at `pathInTar`. Only relevant if `pathInTar` is set (not yet supported
with `pathInZip`).

Type: `string` (is [formatted](#string-formatting))

If set, treats `pathInTar` as a directory, and extracts the contents
to a directory created at `target`. The executable itself is then at
`${target}/${executableSubPathInDir}`.

### `executableSubPathSymlink`

Required?: no, defaults to no symlink created.

Type: `string`

If set, creates a symlink from the given path to the executable at
`${target}/${executableSubPathInDir}`.

### `gzExtract`

Required?: no, defaults to saving the downloaded file as-is

Type: `boolean`

If set to `true`, gzip-extract the downloaded file. Can be used in
conjunction with `pathInTar` to handle `.tar.gz` files.

### `bz2Extract`

Required?: no, defaults to saving the downloaded file as-is

Type: `boolean`

If set to `true`, bz2-extract the downloaded file. Can be used in
conjunction with `pathInTar` to handle `.tar.bz2` files.

Note: if `bz2Extract` and `gzExtract` are both set to `true`, will
gzip-extract then bz2-extract, but this is not expected to be a real
use case.

### `hashValueUrl`

Required?: must set one of: `execIsOk`; `version`; `hashValueUrl`

Type: `string` (is [formatted](#string-formatting))

URL that returns checksum data about the executable file. Possibly
with `hashMethod` and `hashChecksumFileMatchFilepath`, use this to
check if the local file is the correct version by comparing its hash
with a published, expected hash. Note that need for the hash of the
executable itself to be published at this URL, not of the archive used
to distribute it.

### `hashMethod`

Required?: no, by default uses `sha256`. Only relevant if `hashValueUrl` is set.

Type: `string`

A hash algorithm that node's `crypto.createHash` understands.

### `hashChecksumFileMatchFilepath`

Required?: no, by default the value fetched from `hashValueUrl`
as-is. Only relevant if `hashValueUrl` is set.

Type: `string` (is [formatted](#string-formatting))

If the data returned from `hashValueUrl` is not a single hash, but
rather a list of hashes as returned by a utility like `sha256sum`,
that lists hashes and filenames, use this to identify the filename
whose hash to use.

### `messager`

Required?: no

Type: `(message: FetchExecutableMessage) => void`

A function that is called when `fetchExecutable` does things. Intended
to allow for communication with the user about what is going on, for
example, when downloading a potentially large file over a potentially
slow network connection.

Note that this takes precedence over `messagerBuiltin`.

Note that `FetchExecutableMessage` is exported and has the form:
```typescript
interface FetchExecutableMessage {
    message: string;
    kind: string;
    target: string;
    isVerbose: boolean;
}
```

The `kind` string attribute will be one of:
- `'executable_is_ok'`, when the pre-existing executable has been checked and is OK
- `'fetching'`, when starting to fetch
- `'fetch_progress'`, progress during fetch
- `'saving'`, when starting to save
- `'done'`, when saved and made executable

### `messagerBuiltin`

Required?: no

Type: `string` (one of: `'string'`, `'json'`)

Shortcuts for some simple builtin messagers.

- `'string'`: just prints the `message` attribute
- `'json'`: just prints the whole message as a JSON object

If a string other than the above options is passed, is ignored.

### `messagerBuiltinVerbose`

Required?: no, by default verbose messages not included. Only relevant
if `messagerBuiltin` is set.

Type: `boolean`

Whether the builtin messagers should include the messages that have
`isVerbose: true`.

### `messagerBuiltinStream`

Required?: no, by default messages are printed to
`process.stderr`. Only relevant if `messagerBuiltin` is set.

Type: `stream.Writable`

The stream to which messages from the builtin messager are written.

## String formatting

As a convenience, for the string options noted above, can perform
formatting with the following variables:

- `version`, value of the `version` option, if set
- `platform`, value of `process.platform`
- `arch`, value of `process.arch`

Also, the following transformers are available:

- `capitalize`, upper-case the first character
- `x64ToAmd64`, if the passed value is `'x64'`, return `'amd64'` (intended for use with `arch`)

Eg:
```
url: 'https://example.com/download/my-exec/{version}/{platform!capitalize}.tar.gz',
version: '1.2.3',
gzExtract: true,
pathInTar: '{arch!x64ToAmd64}/my-exec',
```

On a Linux, 64-bit OS, would retrieve the file from
`https://example.com/download/my-exec/1.2.3/Linux.tar.gz`, and gzip
extract, and retrieve the file from `amd64/my-exec`.
