FROM node:16-alpine

WORKDIR /opt/osuahr
COPY package.json package-lock.json tsconfig.json ./
RUN npm install

COPY config/ config/
COPY src/ src/
CMD npm run start