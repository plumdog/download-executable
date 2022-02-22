jest.mock('axios', () => {
    if (process.env.OLD_DEPENDENCIES) {
        return jest.requireActual('axios-old');
    }
    return jest.requireActual('axios');
});

jest.mock('string-format', () => {
    if (process.env.OLD_DEPENDENCIES) {
        return jest.requireActual('string-format-old');
    }
    return jest.requireActual('string-format');
});

jest.mock('tar-stream', () => {
    if (process.env.OLD_DEPENDENCIES) {
        return {
            __esModule: true,
            ...jest.requireActual('tar-stream-old'),
        };
    }
    return {
        __esModule: true,
        ...jest.requireActual('tar-stream'),
    };
});

jest.mock('tar', () => {
    if (process.env.OLD_DEPENDENCIES) {
        return {
            __esModule: true,
            ...jest.requireActual('tar-old'),
        };
    }
    return {
        __esModule: true,
        ...jest.requireActual('tar'),
    };
});

jest.mock('unbzip2-stream', () => {
    if (process.env.OLD_DEPENDENCIES) {
        return jest.requireActual('unbzip2-stream-old');
    }
    return jest.requireActual('unbzip2-stream');
});

jest.mock('unzip-stream', () => {
    if (process.env.OLD_DEPENDENCIES) {
        return jest.requireActual('unzip-stream-old');
    }
    return jest.requireActual('unzip-stream');
});
