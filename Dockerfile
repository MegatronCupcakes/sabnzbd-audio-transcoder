FROM node:20-bookworm-slim
LABEL org.opencontainers.image.authors="MegatronCupcakes"

ARG DEBIAN_FRONTEND=noninteractive
COPY ./ /app
RUN apt-get update && apt-get install -y unrar-free unzip
RUN cd /app && npm install
WORKDIR /app
EXPOSE 3000
CMD node index.js
