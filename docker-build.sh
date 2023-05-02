#!/bin/sh
clear

DOCKERTAG='megatroncupcakes/audio_transcoder'
PROJECTNAME=`echo $DOCKERTAG | sed -e "s/\//-/g" | sed -e "s/_/-/g"`
INFO="[$PROJECTNAME-docker-build]"
# The project directory is always the current directory
PROJECTDIR=`pwd`
mkdir -p "$PROJECTDIR"/dist/
rm "$PROJECTDIR"/dist/*
# Assemble a list of Docker tags
CONTAINERNAME="$PROJECTNAME-build"
TIMESTAMP=$(date +"%Y-%m-%d__%T")

# ------------------------------
# Docker image build
# ------------------------------
DATETAG=$DOCKERTAG:$(date +"%m-%d-%Y")
echo DATETAG: $DATETAG
echo $INFO Starting Docker build.....
docker build -t $DATETAG "$PROJECTDIR"
echo $INFO tagging image as latest
`docker tag $DATETAG $DOCKERTAG:latest`
echo $INFO outputting Docker image to dist.....
docker save -o "$PROJECTDIR/dist/${PROJECTNAME}_$(date +"%m-%d-%Y")" $DOCKERTAG:latest

# ------------------------------
# Finished
# ------------------------------
echo $INFO Build finished.
