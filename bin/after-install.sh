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

cd /opt/fwcloud/api/bin
mkdir ../config/tls
./update-cert.sh api >/dev/null

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
TYPEORM_HOST=
TYPEORM_PORT=
TYPEORM_DATABASE=
TYPEORM_USERNAME=
TYPEORM_PASSWORD=" > "$ENVF"
fi

# Make sure that all files are owned by the fwcloud user and group.
cd /opt/fwcloud
chown -R fwcloud:fwcloud api && chmod 750 api

# Generate keys and run migrations. 
cd api
node fwcli keys:generate 
node fwcli migration:run 
node fwcli migration:data

# Enable and start FWCloud-Websrv service.
systemctl enable fwcloud-api
systemctl start fwcloud-api

exit 0
