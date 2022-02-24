FROM node:16.14.0

ARG FWCLOUD_VERSION=devel

RUN apt update && apt install -y default-mysql-client
RUN wget -c -O /tmp/fwcloud-api.zip https://github.com/soltecsis/fwcloud-api/archive/refs/tags/v$FWCLOUD_VERSION.zip

WORKDIR /tmp
RUN unzip /tmp/fwcloud-api.zip
RUN mv fwcloud-api-$FWCLOUD_VERSION /fwcloud-api

WORKDIR /fwcloud-api

RUN npm install && npm run build

COPY env.default .env.default
COPY run.sh run.sh
RUN chmod u+x run.sh

RUN echo $FWCLOUD_VERSION

CMD ["sh", "-c", "./run.sh"]