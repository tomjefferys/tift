FROM ubuntu:latest

RUN apt-get -y update
RUN apt-get -y upgrade
RUN apt-get install -y build-essential
RUN apt-get -y install git
RUN apt-get -y install npm
RUN npm install -g typescript

RUN git clone https://github.com/tomjefferys/tift.git

WORKDIR /tift/types
RUN npm install
RUN tsc

WORKDIR /tift/engine
RUN npm install
RUN tsc

WORKDIR /tift/react-app
RUN npm install
CMD ["npm", "start"]
EXPOSE 3000
