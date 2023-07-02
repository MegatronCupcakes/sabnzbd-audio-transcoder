import express from 'express';
import transcode from './lib/transcode.js';

const app = express();
app.use(express.json());

app.post('/transcode', (request, response) => {
    transcode(request)
    .then((successBool) => {
        if(successBool){
            response.status(200).send("transcoding complete!\n");
        } else {
            response.status(500).send("transcoding produced invalid files; great sadness for all :-(\n");
        }
    })
    .catch((error) => {
        response.status(500).send(`transcoding error! transcoding failed :-(\n(${error.message ? error.message : error})\n`);
    });
});

app.listen(3000);
