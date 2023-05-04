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

# Verify that Node.js and NPM are installed.
NODE=`which node`
NPM=`which npm`

if [ -z "$NODE" ]; then
  echo
  echo "ERROR: Node.js must be installed."
  echo
  exit 1
fi

if [ -z "$NPM" ]; then
  echo
  echo "ERROR: Npm must be installed."
  echo
  exit 1
fi


# Create the fwcloud user and group.
groupadd fwcloud 2>/dev/null
useradd fwcloud -g fwcloud -m -c "SOLTECSIS - FWCloud.net" -s `which bash` 2>/dev/null

exit 0
