FROM node:22.10.0-alpine
ENV NODE_ENV=production

ARG IMAGE_VERSION
ENV QUIZLORD_VERSION=$IMAGE_VERSION

WORKDIR /app

COPY package*.json ./
COPY ./dist/ ./
COPY ./prisma ./prisma

RUN npm ci --omit=dev

CMD [ "node", "index.js" ]
