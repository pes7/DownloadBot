 FROM node:15-alpine
 WORKDIR ./DownloadBot
 COPY . .
 RUN yarn install --production
 CMD ["node", "bot.js"]