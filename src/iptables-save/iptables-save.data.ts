/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

export const NetFilterTables = new Set<string>([
  'nat',
  'raw',
  'mangle',
  'filter'
]);

export const StdChains = new Set<string>([
  'INPUT',
  'OUTPUT',
  'FORWARD',
  'PREROUTING',
  'POSTROUTING'
]);

export const TcpFlags = new Map<string, number>([
  ['URG', 1],
  ['ACK', 2],
  ['PSH', 4],
  ['RST', 8],
  ['SYN', 16],
  ['FIN', 32]
]);

/*
mysql> select * from policy_type;
+----+------+--------------+------------+-------------+
| id | type | name         | type_order | show_action |
+----+------+--------------+------------+-------------+
|  1 | I    | Input        |          1 |           1 |
|  2 | O    | Output       |          2 |           1 |
|  3 | F    | Forward      |          3 |           1 |
|  4 | S    | SNAT         |          4 |           0 |
|  5 | D    | DNAT         |          5 |           0 |
|  6 | R    | Routing      |          6 |           1 |
| 61 | I6   | Input IPv6   |          1 |           1 |
| 62 | O6   | Output IPv6  |          2 |           1 |
| 63 | F6   | Forward IPv6 |          3 |           1 |
| 64 | S6   | SNAT IPv6    |          4 |           0 |
| 65 | D6   | DNAT IPv6    |          5 |           0 |
+----+------+--------------+------------+-------------+
*/
export const PolicyTypeMap = new Map<string, number>([
  ['filter:INPUT', 1],
  ['filter:OUTPUT', 2],
  ['filter:FORWARD', 3],
  ['nat:POSTROUTING', 4], // SNAT
  ['nat:PREROUTING', 5], // DNAT
]);

/*
mysql> select * from policy_position;
+----+------------------------+-------------+----------------+---------+---------------+
| id | name                   | policy_type | position_order | content | single_object |
+----+------------------------+-------------+----------------+---------+---------------+
|  1 | Source                 |           1 |              2 | O       |             0 |
|  2 | Destination            |           1 |              3 | O       |             0 |
|  3 | Service                |           1 |              4 | O       |             0 |
|  4 | Source                 |           2 |              2 | O       |             0 |
|  5 | Destination            |           2 |              3 | O       |             0 |
|  6 | Service                |           2 |              4 | O       |             0 |
|  7 | Source                 |           3 |              3 | O       |             0 |
|  8 | Destination            |           3 |              4 | O       |             0 |
|  9 | Service                |           3 |              5 | O       |             0 |
| 11 | Source                 |           4 |              2 | O       |             0 |
| 12 | Destination            |           4 |              3 | O       |             0 |
...

mysql> select * from policy_type;
+----+------+--------------+------------+-------------+
| id | type | name         | type_order | show_action |
+----+------+--------------+------------+-------------+
|  1 | I    | Input        |          1 |           1 |
|  2 | O    | Output       |          2 |           1 |
|  3 | F    | Forward      |          3 |           1 |
|  4 | S    | SNAT         |          4 |           0 |
|  5 | D    | DNAT         |          5 |           0 |
|  6 | R    | Routing      |          6 |           1 |
| 61 | I6   | Input IPv6   |          1 |           1 |
| 62 | O6   | Output IPv6  |          2 |           1 |
| 63 | F6   | Forward IPv6 |          3 |           1 |
| 64 | S6   | SNAT IPv6    |          4 |           0 |
| 65 | D6   | DNAT IPv6    |          5 |           0 |
+----+------+--------------+------------+-------------+
*/
export const PositionMap = new Map<string, number>([
  ['filter:INPUT:-i', 20],
  ['filter:INPUT:-s', 1], ['filter:INPUT:--src-range', 1],
  ['filter:INPUT:-d', 2], ['filter:INPUT:--dst-range', 2],
  ['filter:INPUT:-p', 3], ['filter:INPUT:srvc', 3],

  ['filter:OUTPUT:-o', 21],
  ['filter:OUTPUT:-s', 4], ['filter:OUTPUT:--src-range', 4],
  ['filter:OUTPUT:-d', 5], ['filter:OUTPUT:--dst-range', 5],
  ['filter:OUTPUT:-p', 6], ['filter:OUTPUT:srvc', 6],

  ['filter:FORWARD:-i', 22],
  ['filter:FORWARD:-o', 25],
  ['filter:FORWARD:-s', 7], ['filter:FORWARD:--src-range', 7],
  ['filter:FORWARD:-d', 8], ['filter:FORWARD:--dst-range', 8],
  ['filter:FORWARD:-p', 9], ['filter:FORWARD:srvc', 9],

  ['nat:POSTROUTING:-o', 24], // SNAT
  ['nat:POSTROUTING:-s', 11], ['nat:POSTROUTING:--src-range', 11],
  ['nat:POSTROUTING:-d', 12], ['nat:POSTROUTING:--dst-range', 12],
  ['nat:POSTROUTING:-p', 13], ['nat:POSTROUTING:srvc', 13],
  ['nat:POSTROUTING:--to-source_ip', 14],
  ['nat:POSTROUTING:--to-source_port', 16], ['nat:POSTROUTING:--to-ports', 16],

  ['nat:PREROUTING:-i', 36], // DNAT
  ['nat:PREROUTING:-s', 30], ['nat:PREROUTING:--src-range', 30],
  ['nat:PREROUTING:-d', 31], ['nat:PREROUTING:--dst-range', 31],
  ['nat:PREROUTING:-p', 32], ['nat:PREROUTING:srvc', 32],
  ['nat:PREROUTING:--to-destination_ip', 34],
  ['nat:PREROUTING:--to-destination_port', 35],
]);

export const AgrupablePositionMap = new Map<string, number[]>([
  ['filter:INPUT', [1,2,3]],
  ['filter:OUTPUT', [4,5,6]],
  ['filter:FORWARD', [7,8,9]],
  ['nat:POSTROUTING', [11,12,13]], // SNAT
  ['nat:PREROUTING', [30,31,32]] // DNAT
]);

// For each module to ignore, one array of strings arrays.
// The fisrt string array for options with no parameters, 
// the second for options with one parameter, and so on ...
export const ModulesIgnoreMap = new Map<string, string[][]>([
  ['account', [['--ashort'], ['--aaddr','--aname']]],
  ['addrtype', [[], ['--src-type', '--dst-type']]],
  ['ah', [[], ['--ahspi']]],
  ['childlevel', [[], ['--childlevel']]],
  ['condition', [[], ['--condition']]],
  ['connbytes', [[], ['--connbytes','--connbytes-dir','--connbytes-mode']]],
  ['connlimit', [[], ['--connlimit-above','--connlimit-mask']]],
  ['connmark', [[], ['--mark']]],
  ['connrate', [[], ['--connrate']]],
  ['dccp', [[], ['--source-port','--sport','--destination-port','--dport','--dccp-types','--dccp-option']]],
  ['dscp', [[], ['--dscp','--dscp-class']]],
  ['dstlimit', [[], ['--dstlimit','--dstlimit-mode','--dstlimit-name','--dstlimit-burst','--dstlimit-htable-size','--dstlimit-htable-max','--dstlimit-htable-gcinterval','--dstlimit-htable-expire']]],
  ['ecn', [['--ecn-tcp-cwr','--ecn-tcp-ece'], ['--ecn-ip-ect']]],
  ['esp', [[], ['--espspi']]],
  ['fuzzy', [[], ['--lower-limit','--upper-limit']]],
  ['hashlimit', [[], ['--hashlimit','--hashlimit-burst','--hashlimit-mode','--hashlimit-name','--hashlimit-htable-size','--hashlimit-htable-max','--hashlimit-htable-expire','--hashlimit-htable-gcinterval']]],
  ['helper', [[], ['--helper']]],
  ['ipv4options', [['--ssrr','--lsrr','--no-srr','--rr','--ts','--ra','--any-opt'], []]],
  ['length', [[], ['--length']]],
  ['limit', [[], ['--limit','--limit-burst']]],
  ['mac', [[], ['--mac-source']]],
  ['mark', [[], ['--mark']]],
  ['nth', [[], ['--every','--counter','--start','--packet']]],
  ['osf', [['--smart','--netlink',], ['--log','--genre']]],
  ['owner', [[], ['--uid-owner','--gid-owner','--pid-owner','--sid-owner','--cmd-owner']]],
  ['physdev', [['--physdev-is-in','--physdev-is-out','--physdev-is-bridged'], ['--physdev-in','--physdev-out']]],
  ['pkttype', [[], ['--pkt-type']]],
  ['policy', [['--strict','--next'], ['--dir','--pol','--reqid','--spi','--proto','--mode','--tunnel-src','--tunnel-dst']]],
  ['psd', [[], ['--psd-weight-threshold','--psd-delay-threshold','--psd-lo-ports-weight','--psd-hi-ports-weight']]],
  ['quota', [[], ['--quota']]],
  ['random', [[], ['--average']]],
  ['recent', [['--set','--rcheck','--update','--remove','--rttl'], ['--name','--seconds','--hitcount']]],
  ['sctp', [[], ['--source-port','--sport','--destination-port','--dport'], ['--chunk-types']]],
  ['set', [[], [], ['--set']]],
  ['string', [[], ['--algo','--from','--to','--string']]],
  ['tcpmss', [[], ['--mss']]],
  ['time', [[], ['--timestart','--timestop','--days','--datestart','--datestop']]],
  ['tos', [[], ['--tos']]],
  ['ttl', [[], ['--ttl-eq','--ttl-gt','--ttl-lt']]],
  ['u32', [[], []]],
  ['unclean', [[], []]],
]);

export type IptablesSaveStats = {
  rules: number;
  interfaces: number;
  ipObjs: number;
  modulesIgnored: string[];
}
