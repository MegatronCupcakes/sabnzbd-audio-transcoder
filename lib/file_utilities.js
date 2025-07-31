import _ from 'underscore';
import { env } from 'node:process';
import path from 'node:path';
import { readdir, rm, chown, chmod, lstat, cp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import audioCodecs from './audio_codecs.js';
import archiveFormatMap from './archive_formats.js';

const archiveFormats = _.keys(archiveFormatMap);
const filePerms = 0o775;

const _idDefaults = {
    PLEXUID: 999,
    PLEXGID: 987,
    TEST: 1000
};
const _getId = (testBool, idType) => {
    let _id = _idDefaults[idType];
    if (env[idType]) _id = Number(env[idType]);
    if (testBool) _id = _idDefaults.TEST;
    return _id;
};

export const deleteOriginalFiles = async (transcodedFiles, albumDirectory) => {
    let deleteFiles = await readdir(albumDirectory);
    deleteFiles = deleteFiles.map((file) => {
        return path.join(albumDirectory, file);
    });
    deleteFiles = _.filter(deleteFiles, (file) => {
        return !_.contains(transcodedFiles, file);
    });
    for (const file of deleteFiles) {
        await rm(file, { recursive: true });
    }
    return;
}

export const expandArchives = (filePath) => {
    return new Promise(async (resolve, reject) => {
        try {
            await Promise.all((await readdir(filePath)).map(_file => {
                let _fileExtension = path.extname(_file).slice(1);
                if (_.contains(archiveFormats, _fileExtension)) {
                    // de-compress
                    return new Promise((resolve, reject) => {
                        let _commandArray = archiveFormatMap[_fileExtension].split(" ");
                        let _command = _commandArray.shift();
                        _commandArray = [..._commandArray, _file];
                        const expansion = spawn(_command, _commandArray, { cwd: filePath });
                        expansion.on('stderr', data => console.log(`EXPANSION ERROR: ${JSON.stringify(data)}`));
                        expansion.on('close', () => {
                            resolve();
                        });
                    });
                }
                return new Promise(resolve => resolve());
            }));
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

export const getAudioFiles = (filePath) => {
    return new Promise(async (resolve, reject) => {
        try {
            const _getFileList = async (fn) => {
                // build file list
                let _files = await readdir(filePath);
                let _fileList = _.filter(_files, (_file) => {
                    let _fileExtension = path.extname(_file).slice(1);
                    return _.contains(audioCodecs, _fileExtension);
                });
                if (_.isEmpty(_fileList)) {
                    const _fileStats = await Promise.all(_files.map((_file) => {
                        return lstat(path.join(filePath, _file));
                    }));
                    const _fileInfo = _.zip(_files, _fileStats);
                    let _directory = _.find(_fileInfo, (_info) => {
                        return _info[1].isDirectory();
                    });
                    if (_directory) {
                        _directory = path.join(filePath, _directory[0]);
                        _files = await readdir(_directory);
                        for (const file of _files) {
                            await cp(path.join(_directory, file), path.join(filePath, file), { recursive: true });
                        }
                        // now that we've copied out the files, remove the directory to avoid possible infinite loop
                        await rm(_directory, { recursive: true });
                        _getFileList(fn);
                    } else {
                        // no appropriate files found; delete any existing files before reporting the error
                        await rm(filePath, { recursive: true, force: true });
                        reject(new Error('no audio files found!'));
                    }
                } else {
                    fn(_fileList.map((_file) => { return path.join(filePath, _file) }));
                }
            };
            _getFileList(fileList => resolve(fileList));
        } catch (error) {
            reject(error);
        }
    });
}

export const deleteNonAudioFiles = (filePath, audioFiles) => {
    return new Promise(async (resolve, reject) => {
        try {
            let files = await readdir(filePath);
            files = files.map((file) => { return path.join(filePath, file) });;
            for (const file of files) {
                if (!_.contains(audioFiles, file)) await rm(file, { recursive: true });
            }
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

export const fixDirectoryOwnership = async (filePath, testModeBool) => {
    try {
        await chown(filePath, _getId(testModeBool, 'PLEXUID'), _getId(testModeBool, 'PLEXGID'));
        let files = await readdir(filePath);
        await Promise.all(files.map((file) => {
            return chown(path.join(filePath, file), _getId(testModeBool, 'PLEXUID'), _getId(testModeBool, 'PLEXGID'));
        }));
        return;
    } catch (error) {
        throw error;
    }
}

export const fixDirectoryPermissions = async (filePath) => {
    try {
        await chmod(filePath, filePerms);
        let files = await readdir(filePath);
        await Promise.all(files.map((file) => {
            return chmod(path.join(filePath, file), filePerms);
        }));
        return;
    } catch (error) {
        throw error;
    }
}