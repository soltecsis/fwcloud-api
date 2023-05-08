#!/bin/sh
#############################################
##                                         ##
##  FWCloud.net                            ##
##  https://fwcloud.net                    ##
##  info@fwcloud.net                       ##
##                                         ##
##  Developed by SOLTECSIS, S.L.           ##
##  https://soltecsis.com                  ##
##  info@soltecsis.com                     ##
##                                         ##
#############################################

################################################################
passGen() {
  PASSGEN=`cat /dev/urandom | tr -dc a-zA-Z0-9 | fold -w ${1} | head -n 1`
}
################################################################

################################################################
runSql() {
  # $1=SQL.
  # $2=Ignore error.
  
  RESULT=`echo "$1" | $MYSQL_CMD 2>&1`
  if [ "$?" != "0" -a -z "$2" ]; then
    echo
    echo -e "ERROR: Executing SQL: $1"
    echo "$RESULT"
    exit 1
  fi
}
################################################################

cd /opt/fwcloud/api/bin
mkdir ../config/tls
./update-cert.sh api >/dev/null

# Create the fwcloud database and access user.
DBHOST="localhost"
DBNAME="fwcloud"
DBUSER="fwcdbusr"
passGen 16
DBPASS="$PASSGEN"
MYSQL_CMD="`which mysql` -u root"
runSql "create database $DBNAME CHARACTER SET utf8 COLLATE utf8_general_ci"
runSql "create user '${DBUSER}'@'${DBHOST}' ${IDENTIFIED_BY} '${DBPASS}'"
runSql "grant all privileges on ${DBNAME}.* to '${DBUSER}'@'${DBHOST}'"
runSql "flush privileges"

# Create .env file with default vaules.
ENVF="/opt/fwcloud/api/.env"
cd ..
if [ ! -f "$ENVF" ]; then
  echo "NODE_ENV=prod

APISRV_IP=0.0.0.0

CORS_ENABLED=false
CORS_WHITELIST=
SESSION_SECRET=
CRYPT_SECRET=

# Database connection settings
TYPEORM_CONNECTION=mysql
TYPEORM_HOST=$DBHOST
TYPEORM_PORT=
TYPEORM_DATABASE=$DBNAME
TYPEORM_USERNAME=$DBUSER
TYPEORM_PASSWORD=$DBPASS" > "$ENVF"
fi

# Make sure that all files are owned by the fwcloud user and group.
cd /opt/fwcloud
chown -R fwcloud:fwcloud api && chmod 750 api

# Generate keys and run migrations. 
cd api
node fwcli keys:generate 
node fwcli migration:run 
node fwcli migration:data

# Enable and start FWCloud-API service.
systemctl enable fwcloud-api
systemctl start fwcloud-api

exit 0
