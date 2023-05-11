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

# Check database access.
MYSQL_CMD="`which mysql` -u root"
OUT=`echo "show databases" | $MYSQL_CMD 2>&1`
if [ "$?" != 0 ]; then # We have had an error accesing the database server.
  # Analyze the error.
  if echo "$OUT" | grep -q "Access denied"; then
    MSG="Access to database engine denied"
  else
    MSG="Connecting with database engine. MySQL or MariaDB servers must be installed"
  fi
  echo
  echo "ERROR: $MSG."
  echo
  exit 1
fi

# Create the fwcloud user and group.
groupadd fwcloud 2>/dev/null
useradd fwcloud -g fwcloud -m -c "SOLTECSIS - FWCloud.net" -s `which bash` 2>/dev/null

exit 0
