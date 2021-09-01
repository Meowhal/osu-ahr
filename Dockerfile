FROM node:latest

WORKDIR /opt/osuahr
COPY package.json package-lock.json tsconfig.json ./
RUN npm install

COPY config/ config/
COPY src/ src/
EXPOSE 3115
ENTRYPOINT /bin/bash