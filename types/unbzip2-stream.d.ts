// This can be replaced once https://www.npmjs.com/package/@types/unbzip2-stream exists.
// See https://github.com/DefinitelyTyped/DefinitelyTyped/pull/58828
declare module 'unbzip2-stream' {
    import through = require('through');

    declare function bz2(): through.ThroughStream;

    export = bz2;
}
