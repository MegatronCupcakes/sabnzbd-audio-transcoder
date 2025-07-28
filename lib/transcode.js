import _ from 'underscore';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {env} from 'node:process';
import ffmpeg from 'ffmpeg-static';

const _defaultTimeout = 5 * 1000 * 60; // 5 minute default timeout if no timeout set in ENV

export const transcodeAudioFiles = (files, codec) => {
    return new Promise(async (resolve, reject) => {
        try {
            let outputFilePaths = [];
            // sequentially transcode files to avoid pegging the cpu
            for (const file of files){
                const outputFile = file.replace(path.extname(file), codec[0] == '.' ? codec : `.${codec}`);
                outputFilePaths.push(outputFile);
                console.log(`--- transcoding ${path.basename(file)} => ${path.basename(outputFile)}`);
                await transcodeFile(file, outputFile);                
            }
            console.log(`transcoding complete!\n\n`);
            resolve(outputFilePaths);
        } catch(error){
            reject(error);
        }
    });
}

const transcodeFile = (inputFile, outputFile) => {
    return new Promise((resolve, reject) => {
        let _error;        
        const controller = new AbortController();
        const { signal } = controller;
        const timeout = env.TRANSCODE_TIMEOUT ? env.TRANSCODE_TIMEOUT : _defaultTimeout;
        let _transcode = spawn(ffmpeg, [
            '-i', inputFile,
            '-map', 'a:0',
            '-vbr', '3', outputFile
        ], signal);
        _transcode.on('error', (error) => {
            _error = error;
        });
        _transcode.on('close', (response) => {
            if(response == 0){
                resolve();
            } else {
                reject(_error);
            }
        });
        setTimeout(() => {
            controller.abort();            
            reject(new Error(`transcode of '${inputFile}' aborted due to timeout!`));
        }, timeout);
    });
}

export const validateAudioFiles = (filePaths) => {
    return new Promise(async (resolve, reject) => {
        try {
            const validations = await Promise.all(filePaths.map((filePath) => {
                return validateAudioFile(filePath);
            }));
            resolve(_.every(validations));
        } catch(error){
            reject(new Error(`files failed validation: ${error.message}`));
        }
    });
}

export const validateAudioFile = (filePath) => {
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