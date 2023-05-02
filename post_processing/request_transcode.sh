#!/bin/sh
TRANSCODE_HOST=localhost:3000
OUTPUT_CODEC=m4a
# https://sabnzbd.org/wiki/scripts/post-processing-scripts
echo transcoding $1...
jq -n --arg path "$1" --arg outputCodec "$OUTPUT_CODEC" '{ path: $path, outputCodec: $outputCodec }' | \
    curl \
    --data @- \
    --silent \
    --header "Content-Type: application/json" \
    --request POST \
    --url http://${TRANSCODE_HOST}/transcode