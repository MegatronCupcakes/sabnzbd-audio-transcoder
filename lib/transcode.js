import _ from 'underscore';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {readdir, rm, chown, chmod, lstat, cp} from 'node:fs/promises';
import ffmpeg from 'ffmpeg-static';

const downloadsDir = '/downloads';
const filePerms = 0o777;
const PlexUID = (testModeBool) => {return testModeBool ? 1000 : 997};
const PlexGID = (testModeBool) => {return testModeBool ? 1000 : 997};
const audioCodecs = [
    "8svx","au","snd","cdr","dat","hcom","ogg","prc","sph","sunau","vms","wav",
    "raw","sf","smp","txw","voc","wve","ub","sb","uw","sw","ul","al","lu","la","sl",
    "flac","mp3","m4a","alac"
];

const transcode = (request) => {
    return new Promise(async (resolve, reject) => {
        try {
            let albumDirectory = request.testMode ? request.body.path : path.join(downloadsDir, path.basename(request.body.path));
            // fix permissions
            await _fixDirectoryPermissions(albumDirectory);
            // get file list and remove non-audio files
            let fileList = await _getAudioFiles(albumDirectory);
            await _deleteNonAudioFiles(albumDirectory, fileList);
            // transcode
            let outputFilePaths = await _transcodeFiles(fileList, request.body.outputCodec);
            // validate files
            const allValid = await _validateFiles(outputFilePaths);
            // clean-up
            await _deleteOriginalFiles(outputFilePaths, albumDirectory);
            // fix ownership and permissions
            await _fixDirectoryOwnership(albumDirectory, request.testMode);
            await _fixDirectoryPermissions(albumDirectory);
            resolve(allValid);
        } catch(error){
            reject(error);
        }
    });
};
export default transcode;

const _transcodeFiles = (files, codec) => {
    return new Promise(async (resolve, reject) => {
        try {
            let outputFilePaths = [];
            // sequential transcoding
            for (const file of files){
                const outputFile = file.replace(path.extname(file), codec[0] == '.' ? codec : `.${codec}`);
                outputFilePaths.push(outputFile);
                await _transcodeFile(file, outputFile);
                
            }
            resolve(outputFilePaths);
        } catch(error){
            reject(error);
        }
    });
}

const _transcodeFile = (inputFile, outputFile) => {
    return new Promise((resolve, reject) => {
        let _transcode = spawn(ffmpeg, [
            '-i', inputFile,
            '-vbr', '3', outputFile
        ]);
        _transcode.on('error', function(error){
            console.log(`TRANSCODE ERROR: ${error.message}`);
        });
        _transcode.on('close', function(response){
            if(response == 0){
                resolve();
            } else {
                reject(`TRANSCODE ERROR: ${inputFile} RESPONSE: ${response}`);
            }
        });
    });
}

const _deleteOriginalFiles = async (transcodedFiles, albumDirectory) => {
    let deleteFiles = await readdir(albumDirectory);
    deleteFiles = deleteFiles.map(function(file){
        return path.join(albumDirectory, file);
    });
    deleteFiles = _.filter(deleteFiles, (file) => {
        return !_.contains(transcodedFiles, file);
    });
    for (const file of deleteFiles){
        await rm(file, {recursive: true});
    }
    return;
}

export const _getAudioFiles = (filePath) => {
    return new Promise(async (resolve, reject) => {
        try {
            const _getFileList = async (fn) => {
                let _files = await readdir(filePath);
                let _fileList = _.filter(_files, (_file) => {
                    let _fileExtension = path.extname(_file).slice(1);
                    return _.contains(audioCodecs, _fileExtension);
                });
                if(_.isEmpty(_fileList)){
                    const _fileStats = await Promise.all(_files.map((_file) => {
                        return lstat(path.join(filePath, _file));
                    }));
                    const _fileInfo = _.zip(_files, _fileStats);
                    let _directory = _.find(_fileInfo, (_info) => {
                        return _info[1].isDirectory();
                    });                
                    if(_directory){
                        _directory = path.join(filePath, _directory[0]);
                        _files = await readdir(_directory);
                        for (const file of _files){
                            await cp(path.join(_directory, file), path.join(filePath, file), {recursive: true}); 
                        }
                        // now that we've copied out the files, remove the directory to avoid possible infinite loop
                        await rm(_directory, {recursive: true});
                        _getFileList(fn);
                    } else {
                        reject(new Error('no audio files found!'));
                    }                    
                } else {
                    fn(_fileList.map((_file) => {return path.join(filePath, _file)}));
                }
            };
            _getFileList(fileList => resolve(fileList));
        } catch(error){
            reject(error);
        }
    });
}

const _validateFiles = (filePaths) => {
    return new Promise(async (resolve, reject) => {
        try {
            const validations = await Promise.all(filePaths.map((filePath) => {
                return _validateAudioFile(filePath);
            }));
            resolve(_.every(validations));
        } catch(error){
            reject(new Error(`files failed validation: ${error.message}`));
        }
    });
}

export const _validateAudioFile = (filePath) => {
    return new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpeg, [
            "-v", "error",
            "-i", filePath,            
            "-f", "null",
            "-"
        ]);
        ffmpegProcess.on('close', code => resolve(code == 0));
        ffmpegProcess.on('error', error => reject(error));
    });
}

const _deleteNonAudioFiles = (filePath, audioFiles) => {
    return new Promise(async (resolve, reject) => {
        try {
            let files = await readdir(filePath);
            files = files.map((file) => {return path.join(filePath, file)});;
            for (const file of files){
                if(!_.contains(audioFiles, file)) await rm(file, {recursive: true});
            }
            resolve();
        } catch(error){
            reject(error);
        }
    });
}

const _fixDirectoryOwnership = async (filePath, testModeBool) => {
    try {
        await chown(filePath, PlexUID(testModeBool), PlexGID(testModeBool));
        let files = await readdir(filePath);
        await Promise.all(files.map((file) => {
            return chown(path.join(filePath, file), PlexUID(testModeBool), PlexGID(testModeBool));
        }));
        return;
    } catch (error){
        throw error;
    }    
}

const _fixDirectoryPermissions = async (filePath) => {
    try {
        await chmod(filePath, filePerms);
        let files = await readdir(filePath);
        await Promise.all(files.map((file) => {
            return chmod(path.join(filePath, file), filePerms);
        }));
        return;
    } catch (error){
        throw error;
    }    
}
