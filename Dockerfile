FROM node:8-alpine
ENV NODE_ENV production
WORKDIR /usr/src/eos-job
COPY package*.json ./
RUN npm install -g typescript
RUN npm install --production --silent
COPY . .
RUN tsc
EXPOSE 5000
CMD node ./build/server.js