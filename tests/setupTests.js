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
