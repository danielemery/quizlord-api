FROM node:22.17.1-alpine

# Since alpine 3.21 the location of openssl has moved. This is a workaround to allow prisma access
# openssl at it's previous location. It should be able to be removed once prisma is updated.
# See https://github.com/prisma/prisma/issues/25817 for details.
RUN ln -s /usr/lib/libssl.so.3 /lib/libssl.so.3

ENV NODE_ENV=production

ARG IMAGE_VERSION
ENV QUIZLORD_VERSION=$IMAGE_VERSION

WORKDIR /app

COPY package*.json ./
COPY ./dist/ ./
COPY ./prisma ./prisma

RUN npm ci --omit=dev

CMD [ "node", "index.js" ]
