import _ from 'underscore';
import path from 'node:path';
import {deleteOriginalFiles, getAudioFiles, deleteNonAudioFiles, fixDirectoryOwnership, fixDirectoryPermissions} from './file_utilities.js';
import {transcodeAudioFiles, validateAudioFiles} from './transcode.js';

const downloadsDir = '/downloads';

const doTranscoding = (request) => {
    return new Promise(async (resolve, reject) => {
        try {
            let albumDirectory = request.testMode ? request.body.path : path.join(downloadsDir, path.basename(request.body.path));
            await fixDirectoryPermissions(albumDirectory);
            let fileList = await getAudioFiles(albumDirectory);
            await deleteNonAudioFiles(albumDirectory, fileList);
            let outputFilePaths = await transcodeAudioFiles(fileList, request.body.outputCodec);
            const allValid = await validateAudioFiles(outputFilePaths);
            await deleteOriginalFiles(outputFilePaths, albumDirectory);
            await fixDirectoryOwnership(albumDirectory, request.testMode);
            await fixDirectoryPermissions(albumDirectory);
            resolve(allValid);
        } catch(error){
            reject(error);
        }
    });
};
export default doTranscoding;