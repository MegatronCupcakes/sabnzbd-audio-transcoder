FROM node:18-buster-slim
LABEL org.opencontainers.image.authors="MegatronCupcakes"

COPY ./ /app
RUN cd /app && npm install
WORKDIR /app
EXPOSE 3000
CMD node index.js
