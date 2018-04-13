#!/bin/sh 
#############################################
##                                         ##
##  FWCloud.net                            ##
##  Developed by SOLTECSIS, S.L.           ##
##  http://www.soltecsis.com               ##
##  info@soltecsis.com                     ##
##                                         ##
#############################################

LSMOD=`which lsmod`
MODPROBE=`which modprobe`
#IPTABLES=`which iptables`
IPTABLES="echo"
IP6TABLES=`which ip6tables`
IP=`which ip`

log() {
  echo "$1"
  which "$LOGGER" >/dev/null 2>&1 && $LOGGER -p info "$1"
}

check_cmds() {
  test -z "$LSMOD" && echo "Command 'lsmod' not found!" && exit 1
  test -z "$MODPROBE" && echo "Command 'modprobe' not found!" && exit 1
  test -z "$IPTABLES" && echo "Command 'iptables' not found!" && exit 1
  test -z "$IP" && echo "Command 'ip' not found!" && exit 1
}

load_modules() {
  MODULES_DIR="/lib/modules/`uname -r`/kernel/net/"
  MODULES=$(find $MODULES_DIR -name '*conntrack*' -name '*nat*'|sed  -e 's/^.*\///' -e 's/\([^\.]\)\..*/\1/')
  for module in $MODULES; do
    if $LSMOD | grep ${module} >/dev/null; then continue; fi
    $MODPROBE ${module} ||  exit 1
  done
}

reset_iptables_v4() {
  $IPTABLES -P OUTPUT  DROP
  $IPTABLES -P INPUT   DROP
  $IPTABLES -P FORWARD DROP

  $IPTABLES --flush
  $IPTABLES -X
  $IPTABLES --flush
  $IPTABLES --flush FORWARD
  $IPTABLES --flush INPUT
  $IPTABLES --flush OUTPUT
  $IPTABLES --table nat --flush
  $IPTABLES --table nat --delete-chain
  $IPTABLES --table mangle --flush
  $IPTABLES --table mangle --delete-chain
  $IPTABLES --delete-chain
}

reset_iptables_v6() {
  $IP6TABLES -P OUTPUT  DROP
  $IP6TABLES -P INPUT   DROP
  $IP6TABLES -P FORWARD DROP

  cat /proc/net/ip6_tables_names | while read table; do
    $IP6TABLES -t $table -L -n | while read c chain rest; do
      if test "X$c" = "XChain" ; then
        $IP6TABLES -t $table -F $chain
      fi
    done
    $IP6TABLES -t $table -X
  done
}

reset_all() {
  reset_iptables_v4
  reset_iptables_v6
}


policy_load() {
log "FWCloud.net - Loading firewall policy generated: Wed Feb 28 2018 17:47:55 GMT+0100 (CET)"

echo -e "\nINPUT TABLE\n-----------"

echo "RULE 6 (ID: 761)"
# terstestarrrrr
$IPTABLES  -N FWCRULE761.CH1
$IPTABLES -A INPUT -i eth1 -s 1.1.1.1 -d 10.98.1.254 -m state --state NEW -j FWCRULE761.CH1
$IPTABLES  -A FWCRULE761.CH1 -p tcp -m multiport --dports 11941,8081,80,5190,443 -j ACCEPT
$IPTABLES  -A FWCRULE761.CH1 -p udp --dport 11941 -j ACCEPT

echo "RULE 7 (ID: 818)"
$IPTABLES  -N FWCRULE818.CH2
$IPTABLES  -N FWCRULE818.CH1
$IPTABLES -A INPUT -p tcp -m multiport --dports 2869,443,80 -d 10.98.0.254 -m state --state NEW -j FWCRULE818.CH1
$IPTABLES  -A FWCRULE818.CH1 -s 192.168.1.58 -j FWCRULE818.CH2
$IPTABLES  -A FWCRULE818.CH1 -s 2.2.2.2 -j FWCRULE818.CH2
$IPTABLES  -A FWCRULE818.CH1 -s 10.10.10.11 -j FWCRULE818.CH2
$IPTABLES  -A FWCRULE818.CH2 -i eth2 -j REJECT
$IPTABLES  -A FWCRULE818.CH2 -i tun20 -j REJECT
$IPTABLES  -A FWCRULE818.CH2 -i eth0 -j REJECT

echo "RULE 8 (ID: 760)"
$IPTABLES  -N FWCRULE760.CH1
$IPTABLES -A INPUT -p tcp --dport 23 -s 9.9.9.9 -m state --state NEW -j FWCRULE760.CH1
$IPTABLES  -A FWCRULE760.CH1 -d 224.0.0.13 -j CONTINUE
$IPTABLES  -A FWCRULE760.CH1 -d 10.98.0.254 -j CONTINUE

echo "RULE 9 (ID: 814)"
$IPTABLES -A INPUT -m state --state NEW-j DENY

echo "RULE 10 (ID: 763)"
$IPTABLES  -N FWCRULE763.CH3
$IPTABLES  -N FWCRULE763.CH2
$IPTABLES  -N FWCRULE763.CH1
$IPTABLES -A INPUT -d 10.98.1.254 -m state --state NEW -j FWCRULE763.CH1
$IPTABLES  -A FWCRULE763.CH1 -p tcp --dport 23 -j FWCRULE763.CH2
$IPTABLES  -A FWCRULE763.CH1 -p udp --dport 11941 -j FWCRULE763.CH2
$IPTABLES  -A FWCRULE763.CH2 -s 62.15.232.153 -j FWCRULE763.CH3
$IPTABLES  -A FWCRULE763.CH2 -s 212.170.200.33 -j FWCRULE763.CH3
$IPTABLES  -A FWCRULE763.CH3 -i eth1 -j ACCEPT
$IPTABLES  -A FWCRULE763.CH3 -i eth0 -j ACCEPT

echo "RULE 11 (ID: 762)"
# VPN IPSEC con el CPD de Gestime
$IPTABLES  -N FWCRULE762.CH1
$IPTABLES -A INPUT -p tcp --dport 110 -m state --state NEW -j FWCRULE762.CH1
$IPTABLES -A INPUT -p udp --dport 500 -m state --state NEW -j FWCRULE762.CH1
$IPTABLES  -A FWCRULE762.CH1 -d 192.168.1.58 -j ACCEPT
$IPTABLES  -A FWCRULE762.CH1 -d 66.29.196.54 -j ACCEPT

echo "RULE 12 (ID: 764)"
$IPTABLES -A INPUT -p tcp -m multiport --dports 445,80,8080,443 -s 10.99.4.0/255.255.255.0 -d 10.98.0.0/255.255.255.0 -m state --state NEW-j ACCEPT

echo "RULE 13 (ID: 765)"
# Regla temporal para configurar el nuevo nodo ESX de Gestimed.
$IPTABLES  -N FWCRULE765.CH1
$IPTABLES -A INPUT -i eth0 -p tcp --dport 21 -d 0.0.0.0 -m state --state NEW -j FWCRULE765.CH1
$IPTABLES  -A FWCRULE765.CH1 -s 0.0.0.0 -j ACCEPT
$IPTABLES  -A FWCRULE765.CH1 -s 10.98.1.255 -j ACCEPT

echo "RULE 17 (ID: 769)"
# Pruebas VPN
$IPTABLES -A INPUT -i eth0 -p udp --dport 1194 -s 0.0.0.0 -d 0.0.0.0 -m state --state NEW-j ACCEPT

echo "RULE 18 (ID: 770)"
$IPTABLES -A INPUT -i eth0 -p udp --dport 7890 -s 0.0.0.0 -d 10.98.1.5 -m state --state NEW-j ACCEPT

echo "RULE 22 (ID: 775)"
$IPTABLES -A INPUT -i eth1 -p tcp --dport 14600 -d 10.98.1.254 -m state --state NEW-j ACCEPT

echo "RULE 23 (ID: 776)"
# Acceso a PBX Gestimed
$IPTABLES -A INPUT -i eth1 -p tcp --dport 1494 -s 10.98.1.0/255.255.255.0 -d 0.0.0.0 -m state --state NEW-j ACCEPT

echo "RULE 24 (ID: 777)"
$IPTABLES  -N FWCRULE777.CH3
$IPTABLES  -N FWCRULE777.CH2
$IPTABLES  -N FWCRULE777.CH1
$IPTABLES -A INPUT -d 10.98.1.254 -m state --state NEW -j FWCRULE777.CH1
$IPTABLES  -A FWCRULE777.CH1 -p tcp -m multiport --dports 22,873,1494,445,5001,3300 -j FWCRULE777.CH2
$IPTABLES  -A FWCRULE777.CH1 -p udp -m multiport --dports 53,123,445 -j FWCRULE777.CH2
$IPTABLES  -A FWCRULE777.CH2 -s 10.98.1.0/255.255.255.0 -j FWCRULE777.CH3
$IPTABLES  -A FWCRULE777.CH2 -s 192.168.1.58 -j FWCRULE777.CH3
$IPTABLES  -A FWCRULE777.CH3 -i eth1 -j ACCEPT
$IPTABLES  -A FWCRULE777.CH3 -i eth100 -j ACCEPT

echo "RULE 25 (ID: 778)"
$IPTABLES  -N FWCRULE778.CH1
$IPTABLES -A INPUT -i eth1 -s 10.98.1.0/255.255.255.0 -d 10.98.1.255 -m state --state NEW -j FWCRULE778.CH1
$IPTABLES  -A FWCRULE778.CH1 -p tcp --dport 445 -j ACCEPT
$IPTABLES  -A FWCRULE778.CH1 -p udp --dport 445 -j ACCEPT

echo "RULE 26 (ID: 780)"
# Para las pruebas con los FortiGate de SMResinas.
$IPTABLES -A INPUT -i eth1 -s 0.0.0.0 -d 10.98.1.0/255.255.255.0 -m state --state NEW-j ACCEPT

echo "RULE 27 (ID: 779)"
$IPTABLES -A INPUT -i eth1 -d 0.0.0.0 -m state --state NEW-j ACCEPT

echo "RULE 28 (ID: 781)"
$IPTABLES -A INPUT -p udp --dport 10000:20000 -s 10.55.3.40 -d 10.98.1.245 -m state --state NEW-j ACCEPT

echo "RULE 29 (ID: 782)"
$IPTABLES -A INPUT -p udp --dport 4569 -s 10.70.10.70 -d 10.98.1.245 -m state --state NEW-j ACCEPT

echo "RULE 30 (ID: 783)"
$IPTABLES -A INPUT -p udp --dport 4569 -s 10.55.14.50 -d 10.98.1.245 -m state --state NEW-j ACCEPT

echo "RULE 31 (ID: 784)"
$IPTABLES -A INPUT -p udp --dport 4569 -s 10.5.0.230 -d 10.98.1.245 -m state --state NEW-j ACCEPT

echo "RULE 32 (ID: 785)"
$IPTABLES -A INPUT -p tcp --dport 12000 -s 10.55.3.20 -d 10.98.1.151 -m state --state NEW-j ACCEPT

echo "RULE 33 (ID: 787)"
$IPTABLES -A INPUT -d 0.0.0.0 -m state --state NEW-j ACCEPT

echo "RULE 36 (ID: 789)"
$IPTABLES -A INPUT -p tcp -m multiport --dports 22,5001 -s 10.98.10.37 -d 0.0.0.0 -m state --state NEW-j ACCEPT

echo "RULE 37 (ID: 790)"
# Acceso desde el teléfono IP de Contabilidad.
$IPTABLES -A INPUT -s 0.0.0.0 -d 10.98.1.245 -m state --state NEW-j ACCEPT

echo "RULE 38 (ID: 791)"
# Comentario 791
$IPTABLES -A INPUT -d 10.98.1.245 -m state --state NEW-j ACCEPT

echo "RULE 39 (ID: 792)"
# Sin esta regla no funciona el acceso de 127.0.0.1 a 127.0.0.1 asdf asdf a
$IPTABLES  -N FWCRULE792.CH1
$IPTABLES -A INPUT -s 127.0.2.1 -m state --state NEW -j FWCRULE792.CH1
$IPTABLES -A INPUT -s 9.9.9.9 -m state --state NEW -j FWCRULE792.CH1
$IPTABLES  -A FWCRULE792.CH1 -d 127.0.2.1 -j ACCEPT
$IPTABLES  -A FWCRULE792.CH1 -d 10.10.10.11 -j ACCEPT

echo "RULE 44 (ID: 793)"
# Comentariof asdf asfa sdfasfa
$IPTABLES  -N FWCRULE793.CH2
$IPTABLES  -N FWCRULE793.CH1
$IPTABLES -A INPUT -s 10.10.10.11 -m state --state NEW -j FWCRULE793.CH1
$IPTABLES  -A FWCRULE793.CH1 -p tcp --dport 113 -j FWCRULE793.CH2
$IPTABLES  -A FWCRULE793.CH1 -p udp --dport 1194 -j FWCRULE793.CH2
$IPTABLES  -A FWCRULE793.CH2 -d 10.77.10.29 -j DENY
$IPTABLES  -A FWCRULE793.CH2 -d 6.6.6.6 -j DENY

echo "RULE 46 (ID: 797)"
# asdf sfs asdf
$IPTABLES -A INPUT -m state --state NEW-j ACCEPT

echo "RULE 47 (ID: 794)"
# Another comment.
$IPTABLES  -N FWCRULE794.CH3
$IPTABLES  -N FWCRULE794.CH2
$IPTABLES  -N FWCRULE794.CH1
$IPTABLES -A INPUT -i eth99 -m state --state NEW -j FWCRULE794.CH1
$IPTABLES  -A FWCRULE794.CH1 -s 7.7.7.7 -j FWCRULE794.CH2
$IPTABLES  -A FWCRULE794.CH1 -s null/null -j FWCRULE794.CH2
$IPTABLES  -A FWCRULE794.CH2 -d 6.6.6.6 -j FWCRULE794.CH3
$IPTABLES  -A FWCRULE794.CH2 -d null/null -j FWCRULE794.CH3
$IPTABLES  -A FWCRULE794.CH3 -p udp --sport null --dport null -j ACCEPT
$IPTABLES  -A FWCRULE794.CH3 -p tcp -m multiport --dports 3268,443 -j ACCEPT
$IPTABLES  -A FWCRULE794.CH3 -p udp --dport 33434:33524 -j ACCEPT


echo -e "\nOUTPUT TABLE\n------------"

echo "RULE 2 (ID: 842)"
$IPTABLES -A OUTPUT -m state --state NEW-j REJECT

echo "RULE 3 (ID: 841)"
# Comentario
$IPTABLES -A OUTPUT -o eth0 -p tcp -m multiport --dports 710,1720 -s null/null -d 224.0.0.0/240.0.0.0 -m state --state NEW-j REJECT

echo "RULE 4 (ID: 854)"
# Comentario
$IPTABLES  -N FWCRULE854.CH2
$IPTABLES  -N FWCRULE854.CH1
$IPTABLES -A OUTPUT -o eth0 -p tcp -m multiport --dports 710,1720 -m state --state NEW -j FWCRULE854.CH1
$IPTABLES  -A FWCRULE854.CH1 -s null -j FWCRULE854.CH2
$IPTABLES  -A FWCRULE854.CH1 -s null/null -j FWCRULE854.CH2
$IPTABLES  -A FWCRULE854.CH2 -d 224.0.0.0/240.0.0.0 -j REJECT
$IPTABLES  -A FWCRULE854.CH2 -d 10.98.10.37 -j REJECT

echo "RULE 5 (ID: 850)"
$IPTABLES -A OUTPUT -m state --state NEW-j REJECT


echo -e "\nFORWARD TABLE\n-------------"

echo "RULE 48 (ID: 796)"
# Comentario
# con  varias líneas...
# 
$IPTABLES  -N FWCRULE796.CH3
$IPTABLES  -N FWCRULE796.CH2
$IPTABLES  -N FWCRULE796.CH1
$IPTABLES -A FORWARD -i eth1 -s 10.0.0.5 -m state --state NEW -j FWCRULE796.CH1
$IPTABLES  -A FWCRULE796.CH1 -p tcp --dport 8081 -j FWCRULE796.CH2
$IPTABLES  -A FWCRULE796.CH1 -p udp --dport 514 -j FWCRULE796.CH2
$IPTABLES  -A FWCRULE796.CH2 -o tun20 -j FWCRULE796.CH3
$IPTABLES  -A FWCRULE796.CH2 -o eth0 -j FWCRULE796.CH3
$IPTABLES  -A FWCRULE796.CH3 -d 10.99.4.0/255.255.255.0 -j ACCEPT
$IPTABLES  -A FWCRULE796.CH3 -d 10.98.1.254 -j ACCEPT

echo "RULE 49 (ID: 807)"
# Prueba de comentarios
$IPTABLES  -N FWCRULE807.CH2
$IPTABLES  -N FWCRULE807.CH1
$IPTABLES -A FORWARD -i eth1 -p udp --dport 514 -m state --state NEW -j FWCRULE807.CH1
$IPTABLES  -A FWCRULE807.CH1 -d 46.24.15.81 -j FWCRULE807.CH2
$IPTABLES  -A FWCRULE807.CH1 -d 10.99.2.0/255.255.255.0 -j FWCRULE807.CH2
$IPTABLES  -A FWCRULE807.CH2 -s 10.10.10.11 -j DENY
$IPTABLES  -A FWCRULE807.CH2 -s 224.0.0.1 -j DENY
$IPTABLES  -A FWCRULE807.CH2 -s 224.0.0.14 -j DENY

echo "RULE 50 (ID: 809)"
# Otro comentario
$IPTABLES -A FORWARD -i eth0 -o eth2 -p tcp --dport 8081 -s 9.9.9.9 -d null -m state --state NEW-j REJECT

echo "RULE 51 (ID: 847)"
# Com
$IPTABLES -A FORWARD -s null -d 10.10.10.11 -m state --state NEW-j DENY

echo "RULE 52 (ID: 828)"
$IPTABLES -A FORWARD -m state --state NEW-j DENY

echo "RULE 53 (ID: 833)"
$IPTABLES  -N FWCRULE833.CH1
$IPTABLES -A FORWARD -i eth1 -o eth2 -p udp --dport 514 -d 10.0.0.5 -m state --state NEW -j FWCRULE833.CH1
$IPTABLES  -A FWCRULE833.CH1 -s 10.98.1.254 -j DENY
$IPTABLES  -A FWCRULE833.CH1 -s 46.24.15.81 -j DENY

echo "RULE 54 (ID: 821)"
# Comentario
$IPTABLES -A FORWARD -s 10.10.10.11 -d 9.9.9.9 -m state --state NEW-j ACCEPT

echo "RULE 56 (ID: 829)"
$IPTABLES  -N FWCRULE829.CH1
$IPTABLES -A FORWARD -i eth0 -o eth2 -p tcp --dport 8081 -d null -m state --state NEW -j FWCRULE829.CH1
$IPTABLES  -A FWCRULE829.CH1 -s 10.10.10.11 -j ACCEPT
$IPTABLES  -A FWCRULE829.CH1 -s 10.99.2.0/255.255.255.0 -j ACCEPT


echo -e "\nSNAT TABLE\n----------"


echo -e "\nDNAT TABLE\n----------"
}

status() {
  NL=`$IPTABLES -nL | wc -l`
  if [ $NL -lt 9 ]; then
    echo "ERROR: Policy not loaded"
    exit 1
  else
    echo "OK. Polilcy loaded."
  fi 
}

# Verify that we have all the needed commands.
check_cmds

ACTION="$1"
test -z "$ACTION" && ACTION="start"

case "$ACTION" in
  start)
    load_modules
    reset_all
    #prolog_commands
    policy_load
    echo 1 > /proc/sys/net/ipv4/ip_forward
    #epilog_commands
    ;;

  stop)
    reset_all
    $IPTABLES -P OUTPUT  ACCEPT
    $IPTABLES -P INPUT   ACCEPT
    $IPTABLES -P FORWARD ACCEPT
    ;;

  reload)
    $0 stop
    $0 start
    ;;

  block)
    reset_all
    ;;

  status)
    status
    ;;

  install)
    chown root:root "$0"
    chmod 700 "$0"

    INSTALL_DIR="/etc/fwcloud"    
    test ! -d "$INSTALL_DIR" && {
      mkdir -m 700 -p "$INSTALL_DIR"
      chown root:root "$INSTALL_DIR"
    }

    mv "$0" "$INSTALL_DIR"
    ;;

  *)
    echo "Usage $0 [start|stop|reload|block|status|install]"
    ;;
esac

exit 0
