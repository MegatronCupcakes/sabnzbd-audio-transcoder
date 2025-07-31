import assert from 'node:assert';
import _ from 'underscore';
import fs from 'node:fs/promises';
import doTranscoding from '../lib/do_transcoding.js';
import { getAudioFiles } from '../lib/file_utilities.js';
import { validateAudioFile } from '../lib/transcode.js';
import path from 'node:path';
import { cwd, env } from 'node:process';
import os from 'node:os';
import mute from 'mute';

const _setup = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `audio_transcoder-test-`));
            const originalFilePath = path.join(cwd(), 'test', 'files', 'original files');
            const [originalDir] = await fs.readdir(originalFilePath);
            const originalPath = path.join(originalFilePath, originalDir);
            const originalFiles = await fs.readdir(originalPath);
            const testPath = path.join(tmpDir, originalDir);
            await fs.rm(testPath, { recursive: true }).catch(error => console.log("no previous test files found; beginning test..."));
            await fs.mkdir(testPath);
            await Promise.all(originalFiles.map((file) => {
                return fs.cp(path.join(originalPath, file), path.join(testPath, file), { recursive: true });
            }));
            await doTranscoding({
                body: {
                    path: testPath,
                    outputCodec: 'm4a'
                },
                testMode: true
            });
            const originalAudioFiles = await getAudioFiles(originalPath);
            const outputFiles = await fs.readdir(testPath);
            resolve([originalPath, originalFiles, originalAudioFiles, testPath, outputFiles, async () => {
                await fs.rm(tmpDir, { recursive: true }).catch(error => console.log("something weird just happened."));
            }]);
        } catch (error) {
            reject(error);
        }
    });
};

describe('transcode and file validation tests', function () {

    this.timeout(5 * 60 * 1000);

    let originalPath, originalFiles, originalAudioFiles, testPath, outputFiles, cleanUp;

    before(async function () {
        const unmute = mute();        
        [originalPath, originalFiles, originalAudioFiles, testPath, outputFiles, cleanUp] = await _setup();
        unmute();
    });

    after(function () {
        const unmute = mute();
        cleanUp();
        unmute();
    });

    it('same number of input and output files', async () => {        
        assert(originalFiles.length >= originalAudioFiles.length);
        assert.strictEqual(originalAudioFiles.length, outputFiles.length);        
    });

    it('output files are m4a', async () => {
        const extensions = outputFiles.map((file) => { return _.last(file.split(".")) });
        assert(_.every(extensions, (extension) => { return extension == "m4a" }));
    });

    it('all files are valid m4a', async () => {
        const validations = await Promise.all(outputFiles.map((file) => {
            return validateAudioFile(path.join(testPath, file));
        }));
        assert(_.every(validations));
    });

    it('file verification returns correct status', async () => {
        const nonAudioFilePath = path.join(testPath, 'fakeFile.m4a');
        await fs.writeFile(nonAudioFilePath, 'I am a fake audio file.');
        const nonAudioFileValid = await validateAudioFile(nonAudioFilePath);
        const audioFileValid = await validateAudioFile(path.join(testPath, outputFiles[0]));        
        assert(!nonAudioFileValid);
        assert(audioFileValid);        
    });

});

describe(`transcode abort test`, function () {

    this.timeout(5 * 60 * 1000);

    it('exceeding timeout aborts transcoding', async () => {
        const unmute = mute();
        let error;
        try {
            env.TRANSCODE_TIMEOUT = 1; // super short transcode timeout to test abort
            await _setup();
        } catch (_error) {
            error = _error;
        } finally {
            unmute();
            assert(error.message.includes('aborted due to timeout'));
            delete env.TRANSCODE_TIMEOUT;            
        }
    });
});