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
  if [ -d "${RDIR}/api" ]; then
    runSql "drop database fwcloud"

    rm -rf "${RDIR}/api"
  fi

  if [ ! "$(ls -A $RDIR)" ]; then # Root directory is empty.
    rmdir "$RDIR"

    userdel fwcloud 2>/dev/null
    groupdel fwcloud 2>/dev/null
  fi
fi

# This is necessary because with FPM we don't have yet an --rpm-systemd option like the --deb-systemd option.
SRVFILE="/lib/systemd/system/fwcloud-api.service"
if [ -f "$SRVFILE" ]; then
  rm -f $SRVFILE
fi

# Some Linux distributions have SELinux enabled.
if command -v getenforce >/dev/null 2>&1; then
  if [ $(getenforce) = "Enforcing" ]; then
    semodule -r fwcloud-api
  fi
fi

exit 0
