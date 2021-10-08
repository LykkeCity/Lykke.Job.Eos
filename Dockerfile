FROM node:8-alpine
ENV NODE_ENV production
ARG version=1.0.0
WORKDIR /usr/src/eos-job
COPY . .
RUN npm version ${version}
RUN npm install typescript@3.7.5 -g
RUN npm install --production --silent
RUN tsc
RUN cat /etc/ca-certificates.conf
RUN sed -i 's/mozilla\/DST_Root_CA_X3.crt/\!mozilla\/DST_Root_CA_X3.crt/' /etc/ca-certificates.conf && \
    update-ca-certificates
EXPOSE 5000
CMD node ./build/server.js
