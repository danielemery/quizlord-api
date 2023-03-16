FROM node:18.14.2-alpine
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
COPY ./dist/ ./
COPY ./prisma ./prisma

RUN npm ci --omit=dev

CMD [ "node", "index.js" ]
