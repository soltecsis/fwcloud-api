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

RDIR="/opt/fwcloud"

MYSQL_CMD="`which mysql` -u root"

# Support for MySQL 8.
IDENTIFIED_BY="identified by"
if [ "$DBENGINE" = "MySQL" ]; then
  IS_MARIADB=`echo "show variables like 'version'" | ${MYSQL_CMD} -N | grep -i mariadb`
  # Get MySQL major version number.
  MYSQL_VERSION_MAJOR_NUMBER=`echo "show variables like 'version'" | ${MYSQL_CMD} -N | awk '{print $2}' | awk -F"." '{print $1}'`
  if [ -z "$IS_MARIADB" -a $MYSQL_VERSION_MAJOR_NUMBER -ge 8 ]; then
    IDENTIFIED_BY="identified with mysql_native_password by"
  fi 
fi

# If /opt/fwcloud dir is empty, remove it and remove fwcloud user and group.
if [ -d "$RDIR" ]; then
    rm -rf "${RDIR}/api"

  if [ ! "$(ls -A $RDIR)" ]; then # Root directory is empty.
    rmdir "$RDIR"

    userdel fwcloud 2>/dev/null
    groupdel fwcloud 2>/dev/null
  fi
fi

runSql "drop database fwcloud"

exit 0
