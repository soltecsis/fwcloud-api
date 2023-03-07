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

TLS_DIR="./config/tls"

################################################################
passGen() {
  PASSGEN=`cat /dev/urandom | tr -dc a-zA-Z0-9 | fold -w ${1} | head -n 1`
}
################################################################

################################################################
generateOpensslConfig() {
  cat > openssl.cnf << EOF
[ req ]
distinguished_name = req_distinguished_name
attributes = req_attributes
prompt = no
[ req_distinguished_name ]
O=SOLTECSIS - FWCloud.net
CN=${1}
[ req_attributes ]
[ cert_ext ]
subjectKeyIdentifier=hash
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=clientAuth,serverAuth
EOF
}
################################################################

################################################################
updateTlsCertificate() {
  echo "Generating certificate for fwcloud-${1} ... "

  passGen 32
  CN="fwcloud-${1}-${PASSGEN}"
  generateOpensslConfig "$CN"

  # Private key.
  openssl genrsa -out fwcloud-${1}.key 2048

  # CSR.
  openssl req -config ./openssl.cnf -new -key fwcloud-${1}.key -nodes -out fwcloud-${1}.csr

  # Certificate.
  # WARNING: If we indicate more than 825 days for the certificate expiration date
  # we will not be able to access from Google Chrome web browser.
  openssl x509 -extfile ./openssl.cnf -extensions cert_ext -req \
    -days 825 \
    -signkey fwcloud-${1}.key -in fwcloud-${1}.csr -out fwcloud-${1}.crt
   
  rm openssl.cnf
  rm "fwcloud-${1}.csr"

  chown fwcloud:fwcloud "fwcloud-${1}.key" "fwcloud-${1}.crt"

  echo "DONE"
  echo
}
################################################################

if [ "`whoami`" != "root" ]; then
  echo "ERROR: The $0 script must be run as root user."
  echo
  exit 1
fi

if [ "$1" != "api" -a "$1" != "websrv" "$1" != "updater" ]; then
  echo "ERROR: Bad input parameter."
  echo
  exit 1
fi

if [ !-d "$TLS_DIR" ]; then
  echo "ERROR: TLS directory $TLS_DIR doesn't exists."
  echo
  exit 1
fi

cd "$TLS_DIR"

updateTlsCertificate "$1"

echo 
echo "Restarting fwcloud-${1} service ..."
systemctl restart fwcloud-${1}
echo "DONE"
echo

exit 0
