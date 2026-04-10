#!/bin/sh

LOGGER="/usr/bin/logger -t openvpn-2fa"

AUTHFILE="$1"
CN="${common_name}"
SERVER_CN="${SERVER_CN}"

[ -n "$SERVER_CN" ] || SERVER_CN="default"

TWOFA_FILE="/etc/openvpn/${SERVER_CN}_2fa_users.txt"
SECRET_FILE="/etc/openvpn/google-authenticator/${SERVER_CN}/${CN}"

$LOGGER "START SERVER_CN=${SERVER_CN} CN=${CN} AUTHFILE=${AUTHFILE}"

if [ -z "$CN" ]; then
    $LOGGER "DENY missing client CN"
    exit 1
fi

if [ ! -r "$TWOFA_FILE" ]; then
    $LOGGER "DENY 2FA list not readable: $TWOFA_FILE"
    exit 1
fi

if ! grep -Fxq "$CN" "$TWOFA_FILE"; then
    $LOGGER "ALLOW non-2FA SERVER_CN=${SERVER_CN} CN=${CN}"
    exit 0
fi

if [ -z "$AUTHFILE" ] || [ ! -r "$AUTHFILE" ]; then
    $LOGGER "DENY missing auth file SERVER_CN=${SERVER_CN} CN=${CN}"
    exit 1
fi

USER_IN="$(sed -n '1p' "$AUTHFILE" | tr -d '\r\n')"
PASS_IN="$(sed -n '2p' "$AUTHFILE" | tr -d '\r\n')"

$LOGGER "READ SERVER_CN=${SERVER_CN} CN=${CN} USER=${USER_IN} PWDLEN=${#PASS_IN}"

if [ -z "$USER_IN" ] || [ -z "$PASS_IN" ]; then
    $LOGGER "DENY empty USER/PASS SERVER_CN=${SERVER_CN} CN=${CN}"
    exit 1
fi

if [ "$USER_IN" != "$CN" ]; then
    $LOGGER "DENY username mismatch SERVER_CN=${SERVER_CN} CN=${CN} USER=${USER_IN}"
    exit 1
fi

if [ ! -r "$SECRET_FILE" ]; then
    $LOGGER "DENY secret file not readable: $SECRET_FILE"
    exit 1
fi

SECRET="$(sed -n '1p' "$SECRET_FILE" | tr -d '\r\n')"

if [ -z "$SECRET" ]; then
    $LOGGER "DENY empty secret SERVER_CN=${SERVER_CN} CN=${CN}"
    exit 1
fi

MATCH=0
for OFFSET in -90 -60 -30 0 30 60 90; do
    CODE="$(oathtool --totp -b -N "${OFFSET} sec" "$SECRET" 2>/dev/null)"
    if [ "$PASS_IN" = "$CODE" ]; then
        MATCH=1
        break
    fi
done

if [ "$MATCH" -eq 1 ]; then
    $LOGGER "ALLOW valid TOTP SERVER_CN=${SERVER_CN} CN=${CN}"
    exit 0
fi

$LOGGER "DENY invalid TOTP SERVER_CN=${SERVER_CN} CN=${CN}"
exit 1
