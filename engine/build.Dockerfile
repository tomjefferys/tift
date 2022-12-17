# Builds, lints, and tests the tift engine code
FROM node:17

RUN apt-get -y update
RUN apt-get -y upgrade

RUN apt-get -y install npm
RUN npm install -g typescript
RUN npm install -g jest

COPY . tift/engine/

WORKDIR /tift/engine
RUN npm install
RUN tsc
RUN npm run lint
RUN jest
RUN echo "ALL OK"