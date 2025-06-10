import express from 'express';
import doTranscoding from './lib/do_transcoding.js';

const app = express();
app.use(express.json());

app.post('/transcode', (request, response) => {
    doTranscoding(request)
    .then((successBool) => {
        if(successBool){
            response.status(200).send("transcoding complete!\n");
        } else {
            response.status(500).send("transcoding produced invalid files; great sadness for all :-(\n");
        }
    })
    .catch((error) => {
        let message = 'unknown error occurred; something went wrong and slipped through the cracks.';
        if(error){
            message = error.message ? error.message : error
        }
        response.status(500).send(`transcoding error! transcoding failed :-(\n(${message})\n`);
    });
});

app.listen(3000);
