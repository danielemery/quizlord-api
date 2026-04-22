FROM node:24.15.0-alpine

ENV NODE_ENV=production

ARG IMAGE_VERSION
ENV QUIZLORD_VERSION=$IMAGE_VERSION

WORKDIR /app

COPY package*.json ./
COPY ./dist/ ./
COPY ./prisma ./prisma
COPY ./prisma.config.ts ./prisma.config.ts

RUN npm ci --omit=dev

CMD [ "node", "--import", "./instrument.js", "index.js" ]
