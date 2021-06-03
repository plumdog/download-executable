import { downloadExecutable } from '..';

describe('downloads', () => {
    test('can download file', async () => {
        expect(await downloadExecutable()).toBe(true);
    });
});
