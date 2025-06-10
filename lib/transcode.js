import _ from 'underscore';
import path from 'node:path';
import {spawn} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

export const transcodeAudioFiles = (files, codec) => {
    return new Promise(async (resolve, reject) => {
        try {
            let outputFilePaths = [];
            // sequentially transcode files to avoid pegging the cpu
            for (const file of files){
                const outputFile = file.replace(path.extname(file), codec[0] == '.' ? codec : `.${codec}`);
                outputFilePaths.push(outputFile);
                console.log(`transcoding ${inputFile} => ${outputFile}`);
                await transcodeFile(file, outputFile);                
            }
            resolve(outputFilePaths);
        } catch(error){
            reject(error);
        }
    });
}

const transcodeFile = (inputFile, outputFile) => {
    return new Promise((resolve, reject) => {
        let _error;
        let _transcode = spawn(ffmpeg, [
            '-i', inputFile,
            '-map', 'a:0',
            '-vbr', '3', outputFile
        ]);
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