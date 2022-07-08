FROM node:16-alpine
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
COPY ./dist/* ./
COPY prisma ./

RUN npm ci --omit=dev

CMD [ "node", "index.js" ]
