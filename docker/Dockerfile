FROM node:16

RUN apt update && apt install -y default-mysql-client
RUN wget -c -O /tmp/fwcloud-api.zip https://github.com/soltecsis/fwcloud-api/archive/refs/heads/main.zip

WORKDIR /tmp
RUN unzip fwcloud-api.zip && rm -f fwcloud-api.zip
RUN mkdir -p /opt/fwcloud
RUN mv fwcloud-api-main /opt/fwcloud/api

WORKDIR /opt/fwcloud/api
RUN npm install && npm run build
RUN rm -rf .github .gitignore .DS_Store .vscode tests

COPY env.default .env.default
COPY run.sh run.sh
COPY wait-for-it/wait-for-it.sh wait-for-it.sh
RUN chmod u+x run.sh && chmod u+x wait-for-it.sh

CMD ["sh", "-c", "./run.sh"]
