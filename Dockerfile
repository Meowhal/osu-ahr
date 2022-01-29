FROM node:latest

WORKDIR /opt/osuahr
COPY package.json package-lock.json tsconfig.json ./
RUN npm install

COPY src/ src/
RUN npm run build
COPY config/ config/
EXPOSE 3115
ENTRYPOINT /bin/bash