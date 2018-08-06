-- mysql> describe ipobj;
-- +------------------------+--------------+------+-----+-------------------+-----------------------------+
-- | Field                  | Type         | Null | Key | Default           | Extra                       |
-- +------------------------+--------------+------+-----+-------------------+-----------------------------+
-- | id                     | int(11)      | NO   | PRI | NULL              | auto_increment              |
-- | fwcloud                | int(11)      | YES  | MUL | NULL              |                             |
-- | interface              | int(11)      | YES  | MUL | NULL              |                             |
-- | name                   | varchar(255) | NO   |     | NULL              |                             |
-- | type                   | int(11)      | NO   | MUL | NULL              |                             |
-- | protocol               | int(11)      | YES  |     | NULL              |                             |
-- | address                | varchar(255) | YES  |     | NULL              |                             |
-- | netmask                | varchar(255) | YES  |     | NULL              |                             |
-- | diff_serv              | tinyint(1)   | YES  |     | NULL              |                             |
-- | ip_version             | varchar(255) | YES  |     | NULL              |                             |
-- | icmp_type              | int(11)      | YES  |     | NULL              |                             |
-- | icmp_code              | int(11)      | YES  |     | NULL              |                             |
-- | tcp_flags_mask         | tinyint(1)   | YES  |     | NULL              |                             |
-- | tcp_flags_settings     | tinyint(1)   | YES  |     | NULL              |                             |
-- | range_start            | varchar(255) | YES  |     | NULL              |                             |
-- | range_end              | varchar(255) | YES  |     | NULL              |                             |
-- | source_port_start      | int(11)      | YES  |     | NULL              |                             |
-- | source_port_end        | int(11)      | YES  |     | NULL              |                             |
-- | destination_port_start | int(11)      | YES  |     | NULL              |                             |
-- | destination_port_end   | int(11)      | YES  |     | NULL              |                             |
-- | options                | varchar(255) | YES  |     | NULL              |                             |
-- | comment                | longtext     | YES  |     | NULL              |                             |
-- | created_at             | datetime     | NO   |     | CURRENT_TIMESTAMP |                             |
-- | updated_at             | datetime     | NO   |     | CURRENT_TIMESTAMP | on update CURRENT_TIMESTAMP |
-- | created_by             | int(11)      | NO   |     | 0                 |                             |
-- | updated_by             | int(11)      | NO   |     | 0                 |                             |
-- +------------------------+--------------+------+-----+-------------------+-----------------------------+

-- mysql> select * from ipobj_type;
-- +-----+--------------------+-----------------+---------------------+---------------------+------------+------------+
-- | id  | type               | protocol_number | created_at          | updated_at          | created_by | updated_by |
-- +-----+--------------------+-----------------+---------------------+---------------------+------------+------------+
-- |   0 | FIREWALL           |            NULL | 2017-07-10 13:30:26 | 2017-07-10 13:30:26 |          0 |          0 |
-- |   1 | IP                 |            NULL | 2017-02-21 12:39:51 | 2018-01-18 11:45:17 |          0 |          0 |
-- |   2 | TCP                |               6 | 2017-02-21 12:39:51 | 2018-01-18 12:51:48 |          0 |          0 |
-- |   3 | ICMP               |               1 | 2017-02-21 12:39:51 | 2018-01-18 12:51:48 |          0 |          0 |
-- |   4 | UDP                |              17 | 2017-02-21 12:39:51 | 2018-01-18 12:51:48 |          0 |          0 |
-- |   5 | ADDRESS            |            NULL | 2017-02-21 12:39:51 | 2017-02-21 12:39:51 |          0 |          0 |
-- |   6 | ADDRESS RANGE      |            NULL | 2017-02-21 12:39:51 | 2017-02-21 12:39:51 |          0 |          0 |
-- |   7 | NETWORK            |            NULL | 2017-02-21 12:39:51 | 2017-02-21 12:39:51 |          0 |          0 |
-- |   8 | HOST               |            NULL | 2017-06-23 15:31:19 | 2017-06-23 15:31:19 |          0 |          0 |
-- |  10 | INTERFACE FIREWALL |            NULL | 2017-06-19 16:16:29 | 2017-06-23 14:11:11 |          0 |          0 |
-- |  11 | INTERFACE HOST     |            NULL | 2017-06-19 16:24:54 | 2017-06-19 16:24:54 |          0 |          0 |
-- |  20 | GROUP OBJECTS      |            NULL | 2017-06-22 16:20:20 | 2017-06-22 16:20:20 |          0 |          0 |
-- |  21 | GROUP SERVICES     |            NULL | 2017-06-22 16:20:20 | 2017-06-22 16:20:20 |          0 |          0 |
-- | 100 | CLUSTER            |            NULL | 2018-03-12 13:27:52 | 2018-03-12 13:27:52 |          0 |          0 |
-- +-----+--------------------+-----------------+---------------------+---------------------+------------+------------+

INSERT INTO `ipobj` VALUES 

-- IP (IDs from 10000 to 19999)
(42,NULL,NULL,'AH',1,51,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IPSEC Authentication Header Protocol',NOW(),NOW(),0,0),
(43,NULL,NULL,'ESP',1,50,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IPSEC Encapsulating Security Payload Protocol',NOW(),NOW(),0,0),
(44,NULL,NULL,'RR',1,0,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Route recording packets',NOW(),NOW(),0,0),
(45,NULL,NULL,'SRR',1,0,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'All sorts of Source Routing Packets',NOW(),NOW(),0,0),
(46,NULL,NULL,'ip_fragments',1,0,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'\'Short\' fragments',NOW(),NOW(),0,0),
(47,NULL,NULL,'SKIP',1,57,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IPSEC Simple Key Management for Internet Protocols',NOW(),NOW(),0,0),
(48,NULL,NULL,'GRE',1,47,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Generic Routing Encapsulation\n',NOW(),NOW(),0,0),
(49,NULL,NULL,'vrrp',1,112,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Virtual Router Redundancy Protocol',NOW(),NOW(),0,0),
(50,NULL,NULL,'IGMP',1,2,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Internet Group Management Protocol, Version 3, RFC 3376',NOW(),NOW(),0,0),
(51,NULL,NULL,'PIM',1,103,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Protocol Independent Multicast - Dense Mode (PIM-DM), RFC 3973, or Protocol Independent Multicast-Sparse Mode (PIM-SM) RFC 2362',NOW(),NOW(),0,0),

-- TCP (IDs from 20000 to 29999)
(52,NULL,NULL,'ALL TCP Masqueraded',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,61000,65095,0,0,NULL,'ipchains used to use this range of port numbers for masquerading. ',NOW(),NOW(),0,0),
(53,NULL,NULL,'AOL',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5190,5190,NULL,'',NOW(),NOW(),0,0),
(54,NULL,NULL,'All TCP',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(55,NULL,NULL,'Citrix-ICA',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1494,1494,NULL,'',NOW(),NOW(),0,0),
(56,NULL,NULL,'Entrust-Admin',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,709,709,NULL,'Entrust CA Administration Service',NOW(),NOW(),0,0),
(57,NULL,NULL,'Entrust-KeyMgmt',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,710,710,NULL,'Entrust CA Key Management Service',NOW(),NOW(),0,0),
(58,NULL,NULL,'H323',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1720,1720,NULL,'',NOW(),NOW(),0,0),
(59,NULL,NULL,'icslap',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2869,2869,NULL,'Sometimes this protocol is called icslap, but Microsoft does not call it that and just says that DSPP uses port 2869 in Windows XP SP2',NOW(),NOW(),0,0),
(60,NULL,NULL,'LDAP GC',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3268,3268,NULL,'',NOW(),NOW(),0,0),
(61,NULL,NULL,'LDAP GC SSL',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3269,3269,NULL,'',NOW(),NOW(),0,0),
(62,NULL,NULL,'OpenWindows',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2000,2000,NULL,'Open Windows',NOW(),NOW(),0,0),
(63,NULL,NULL,'PCAnywhere-data',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5631,5631,NULL,'data channel for PCAnywhere v7.52 and later ',NOW(),NOW(),0,0),
(64,NULL,NULL,'Real-Audio',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,7070,7070,NULL,'RealNetworks PNA Protocol',NOW(),NOW(),0,0),
(65,NULL,NULL,'RealSecure',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2998,2998,NULL,'',NOW(),NOW(),0,0),
(66,NULL,NULL,'SMB',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,445,445,NULL,'SMB over TCP (without NETBIOS)\n',NOW(),NOW(),0,0),
(67,NULL,NULL,'TACACSplus',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,49,49,NULL,'',NOW(),NOW(),0,0),
(68,NULL,NULL,'TCP high ports',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1024,65535,NULL,'TCP high ports',NOW(),NOW(),0,0),
(69,NULL,NULL,'WINS replication',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,42,42,NULL,'',NOW(),NOW(),0,0),
(70,NULL,NULL,'X11',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,6000,6063,NULL,'X Window System',NOW(),NOW(),0,0),
(71,NULL,NULL,'auth',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,113,113,NULL,'',NOW(),NOW(),0,0),
(72,NULL,NULL,'daytime',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,13,13,NULL,'',NOW(),NOW(),0,0),
(73,NULL,NULL,'domain',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,53,53,NULL,'',NOW(),NOW(),0,0),
(74,NULL,NULL,'eklogin',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2105,2105,NULL,'',NOW(),NOW(),0,0),
(75,NULL,NULL,'finger',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,79,79,NULL,'',NOW(),NOW(),0,0),
(76,NULL,NULL,'ftp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,21,21,NULL,'',NOW(),NOW(),0,0),
(77,NULL,NULL,'ftp data',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,20,20,1024,65535,NULL,'FTP data channel.\n  Note: FTP protocol does not really require server to use source port 20 for the data channel, \n  but many ftp server implementations do so.',NOW(),NOW(),0,0),
(78,NULL,NULL,'ftp data passive',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,20,20,NULL,'FTP data channel for passive mode transfers\n',NOW(),NOW(),0,0),
(79,NULL,NULL,'http',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,80,80,NULL,'',NOW(),NOW(),0,0),
(80,NULL,NULL,'https',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,443,443,NULL,'',NOW(),NOW(),0,0),
(81,NULL,NULL,'imap',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,143,143,NULL,'',NOW(),NOW(),0,0),
(82,NULL,NULL,'imaps',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,993,993,NULL,'',NOW(),NOW(),0,0),
(83,NULL,NULL,'irc',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,6667,6667,NULL,'',NOW(),NOW(),0,0),
(84,NULL,NULL,'kerberos',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,88,88,NULL,'',NOW(),NOW(),0,0),
(85,NULL,NULL,'klogin',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,543,543,NULL,'',NOW(),NOW(),0,0),
(86,NULL,NULL,'ksh',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,544,544,NULL,'',NOW(),NOW(),0,0),
(87,NULL,NULL,'ldap',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,389,389,NULL,'',NOW(),NOW(),0,0),
(88,NULL,NULL,'ldaps',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,636,636,NULL,'Lightweight Directory Access Protocol over TLS/SSL',NOW(),NOW(),0,0),
(89,NULL,NULL,'linuxconf',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,98,98,NULL,'',NOW(),NOW(),0,0),
(90,NULL,NULL,'lpr',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,515,515,NULL,'',NOW(),NOW(),0,0),
(91,NULL,NULL,'microsoft-rpc',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,135,135,NULL,'',NOW(),NOW(),0,0),
(92,NULL,NULL,'ms-sql',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1433,1433,NULL,'Microsoft SQL Server',NOW(),NOW(),0,0),
(93,NULL,NULL,'mysql',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3306,3306,NULL,'',NOW(),NOW(),0,0),
(94,NULL,NULL,'netbios-ssn',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,139,139,NULL,'',NOW(),NOW(),0,0),
(95,NULL,NULL,'nfs',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2049,2049,NULL,'',NOW(),NOW(),0,0),
(96,NULL,NULL,'nntp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,119,119,NULL,'',NOW(),NOW(),0,0),
(97,NULL,NULL,'nntps',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,563,563,NULL,'NNTP over SSL',NOW(),NOW(),0,0),
(98,NULL,NULL,'pop3',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,110,110,NULL,'',NOW(),NOW(),0,0),
(99,NULL,NULL,'pop3s',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,995,995,NULL,'POP-3 over SSL',NOW(),NOW(),0,0),
(100,NULL,NULL,'postgres',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5432,5432,NULL,'',NOW(),NOW(),0,0),
(101,NULL,NULL,'printer',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,515,515,NULL,'',NOW(),NOW(),0,0),
(102,NULL,NULL,'quake',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,26000,26000,NULL,'',NOW(),NOW(),0,0),
(103,NULL,NULL,'rexec',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,512,512,NULL,'',NOW(),NOW(),0,0),
(104,NULL,NULL,'rlogin',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,513,513,NULL,'',NOW(),NOW(),0,0),
(105,NULL,NULL,'rshell',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,514,514,NULL,'',NOW(),NOW(),0,0),
(106,NULL,NULL,'rtsp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,554,554,NULL,'Real Time Streaming Protocol',NOW(),NOW(),0,0),
(107,NULL,NULL,'rwhois',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,4321,4321,NULL,'',NOW(),NOW(),0,0),
(108,NULL,NULL,'securidprop',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5510,5510,NULL,'',NOW(),NOW(),0,0),
(109,NULL,NULL,'smtp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,25,25,NULL,'',NOW(),NOW(),0,0),
(110,NULL,NULL,'smtps',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,465,465,NULL,'',NOW(),NOW(),0,0),
(111,NULL,NULL,'socks',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1080,1080,NULL,'',NOW(),NOW(),0,0),
(112,NULL,NULL,'sqlnet1',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1521,1521,NULL,'',NOW(),NOW(),0,0),
(113,NULL,NULL,'squid',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3128,3128,NULL,'',NOW(),NOW(),0,0),
(114,NULL,NULL,'ssh',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,22,22,NULL,'',NOW(),NOW(),0,0),
(115,NULL,NULL,'sunrpc',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,111,111,NULL,'',NOW(),NOW(),0,0),
(116,NULL,NULL,'tcp-syn',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(117,NULL,NULL,'telnet',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,23,23,NULL,'',NOW(),NOW(),0,0),
(118,NULL,NULL,'uucp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,540,540,NULL,'',NOW(),NOW(),0,0),
(119,NULL,NULL,'winterm',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3389,3389,NULL,'Windows Terminal Services',NOW(),NOW(),0,0),
(120,NULL,NULL,'xfs',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,7100,7100,NULL,'',NOW(),NOW(),0,0),
(121,NULL,NULL,'xmas scan - full',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'This service object matches TCP packet with all six flags set.',NOW(),NOW(),0,0),
(122,NULL,NULL,'xmas scan',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'This service object matches TCP packet with flags FIN, PSH and URG set and other flags cleared. This is a  \"christmas scan\" as defined in snort rules. Nmap can generate this scan, too.',NOW(),NOW(),0,0),
(123,NULL,NULL,'rsync',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,873,873,NULL,'',NOW(),NOW(),0,0),
(124,NULL,NULL,'distcc',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3632,3632,NULL,'distributed compiler',NOW(),NOW(),0,0),
(125,NULL,NULL,'cvspserver',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2401,2401,NULL,'CVS client/server operations',NOW(),NOW(),0,0),
(126,NULL,NULL,'cvsup',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5999,5999,NULL,'CVSup file transfer/John Polstra/FreeBSD',NOW(),NOW(),0,0),
(127,NULL,NULL,'afp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,548,548,NULL,'AFP (Apple file sharing) over TCP',NOW(),NOW(),0,0),
(128,NULL,NULL,'whois',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,43,43,NULL,'',NOW(),NOW(),0,0),
(129,NULL,NULL,'bgp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,179,179,NULL,'',NOW(),NOW(),0,0),
(130,NULL,NULL,'radius',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1812,1812,NULL,'Radius protocol',NOW(),NOW(),0,0),
(131,NULL,NULL,'radius acct',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1813,1813,NULL,'Radius Accounting',NOW(),NOW(),0,0),
(132,NULL,NULL,'upnp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5000,5000,NULL,'',NOW(),NOW(),0,0),
(133,NULL,NULL,'upnp-5431',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5431,5431,NULL,'Although UPnP specification say it should use TCP port 5000, Linksys running Sveasoft firmware listens on port 5431',NOW(),NOW(),0,0),
(134,NULL,NULL,'vnc-java-0',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5800,5800,NULL,'Java VNC viewer, display 0',NOW(),NOW(),0,0),
(135,NULL,NULL,'vnc-0',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5900,5900,NULL,'Regular VNC viewer, display 0',NOW(),NOW(),0,0),
(136,NULL,NULL,'vnc-java-1',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5801,5801,NULL,'Java VNC viewer, display 1',NOW(),NOW(),0,0),
(137,NULL,NULL,'vnc-1',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5901,5901,NULL,'Regular VNC viewer, display 1',NOW(),NOW(),0,0),
(138,NULL,NULL,'All TCP established',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Some firewall platforms can match TCP packets with flags ACK or RST set; the option is usually called \"established\".\n\nNote that you can use this object only in the policy rules of the firewall that supports this option.\n\nIf you need to match reply packets for a specific TCP service and wish to use option \"established\", make a copy of this object and set source port range to match the service.\n',NOW(),NOW(),0,0),
(139,NULL,NULL,'rtmp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1935,1935,NULL,'Real Time Messaging Protocol',NOW(),NOW(),0,0),
(140,NULL,NULL,'xmpp-client',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5222,5222,NULL,'Extensible Messaging and Presence Protocol (XMPP)   RFC3920\n',NOW(),NOW(),0,0),
(141,NULL,NULL,'xmpp-server',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5269,5269,NULL,'Extensible Messaging and Presence Protocol (XMPP)   RFC3920\n',NOW(),NOW(),0,0),
(142,NULL,NULL,'xmpp-client-ssl',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5223,5223,NULL,'Extensible Messaging and Presence Protocol (XMPP)   RFC3920\n',NOW(),NOW(),0,0),
(143,NULL,NULL,'xmpp-server-ssl',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5270,5270,NULL,'Extensible Messaging and Presence Protocol (XMPP)   RFC3920\n',NOW(),NOW(),0,0),
(144,NULL,NULL,'nrpe',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5666,5666,NULL,'NRPE add-on for Nagios  http://www.nagios.org/\n',NOW(),NOW(),0,0),

-- ICMP (IDs from 30000 to 39999)
(30000,NULL,NULL,'any ICMP',3,1,NULL,NULL,NULL,NULL,-1,-1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'',NOW(),NOW(),0,0),
(30001,NULL,NULL,'all ICMP unreachables',3,1,NULL,NULL,NULL,NULL,3,-1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'',NOW(),NOW(),0,0),
(30002,NULL,NULL,'host_unreach',3,1,NULL,NULL,NULL,NULL,3,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'',NOW(),NOW(),0,0),
(30003,NULL,NULL,'ping reply',3,1,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'',NOW(),NOW(),0,0),
(30004,NULL,NULL,'ping request',3,1,NULL,NULL,NULL,NULL,8,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'',NOW(),NOW(),0,0),
(30005,NULL,NULL,'port unreach',3,1,NULL,NULL,NULL,NULL,3,3,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Port unreachable',NOW(),NOW(),0,0),
(30006,NULL,NULL,'time exceeded',3,1,NULL,NULL,NULL,NULL,11,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'ICMP messages of this type are needed for traceroute',NOW(),NOW(),0,0),
(30007,NULL,NULL,'time exceeded in transit',3,1,NULL,NULL,NULL,NULL,11,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'',NOW(),NOW(),0,0),

-- UDP (DIs from 40000 to 49999)
(145,NULL,NULL,'ALL UDP Masqueraded',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,61000,65095,0,0,NULL,'ipchains used to use this port range for masqueraded packets',NOW(),NOW(),0,0),
(146,NULL,NULL,'All UDP',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(147,NULL,NULL,'ICQ',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,4000,4000,NULL,'',NOW(),NOW(),0,0),
(148,NULL,NULL,'IKE',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,500,500,NULL,'',NOW(),NOW(),0,0),
(149,NULL,NULL,'PCAnywhere-status',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5632,5632,NULL,'status channel for PCAnywhere v7.52 and later',NOW(),NOW(),0,0),
(150,NULL,NULL,'RIP',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,520,520,NULL,'routing protocol RIP',NOW(),NOW(),0,0),
(151,NULL,NULL,'Radius',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1645,1645,NULL,'',NOW(),NOW(),0,0),
(152,NULL,NULL,'UDP high ports',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1024,65535,NULL,'',NOW(),NOW(),0,0),
(153,NULL,NULL,'Who',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,513,513,NULL,'',NOW(),NOW(),0,0),
(154,NULL,NULL,'afs',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,7000,7009,NULL,'',NOW(),NOW(),0,0),
(155,NULL,NULL,'bootpc',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,68,68,NULL,'',NOW(),NOW(),0,0),
(156,NULL,NULL,'bootps',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,67,67,NULL,'',NOW(),NOW(),0,0),
(157,NULL,NULL,'daytime',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,13,13,NULL,'',NOW(),NOW(),0,0),
(158,NULL,NULL,'domain',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,53,53,NULL,'',NOW(),NOW(),0,0),
(159,NULL,NULL,'interphone',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,22555,22555,NULL,'VocalTec Internet Phone',NOW(),NOW(),0,0),
(160,NULL,NULL,'kerberos',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,88,88,NULL,'',NOW(),NOW(),0,0),
(161,NULL,NULL,'kerberos-adm',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,749,750,NULL,'',NOW(),NOW(),0,0),
(162,NULL,NULL,'kpasswd',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,464,464,NULL,'',NOW(),NOW(),0,0),
(163,NULL,NULL,'krb524',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,4444,4444,NULL,'',NOW(),NOW(),0,0),
(164,NULL,NULL,'microsoft-rpc',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,135,135,NULL,'',NOW(),NOW(),0,0),
(165,NULL,NULL,'netbios-dgm',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,138,138,NULL,'',NOW(),NOW(),0,0),
(166,NULL,NULL,'netbios-ns',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,137,137,NULL,'',NOW(),NOW(),0,0),
(167,NULL,NULL,'netbios-ssn',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,139,139,NULL,'',NOW(),NOW(),0,0),
(168,NULL,NULL,'nfs',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2049,2049,NULL,'',NOW(),NOW(),0,0),
(169,NULL,NULL,'ntp',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,123,123,NULL,'',NOW(),NOW(),0,0),
(170,NULL,NULL,'quake',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,26000,26000,NULL,'',NOW(),NOW(),0,0),
(171,NULL,NULL,'secureid-udp',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1024,1024,NULL,'',NOW(),NOW(),0,0),
(172,NULL,NULL,'snmp',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,161,161,NULL,'',NOW(),NOW(),0,0),
(173,NULL,NULL,'snmp-trap',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,162,162,NULL,'',NOW(),NOW(),0,0),
(174,NULL,NULL,'sunrpc',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,111,111,NULL,'',NOW(),NOW(),0,0),
(175,NULL,NULL,'syslog',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,514,514,NULL,'',NOW(),NOW(),0,0),
(176,NULL,NULL,'tftp',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,69,69,NULL,'',NOW(),NOW(),0,0),
(177,NULL,NULL,'traceroute',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,33434,33524,NULL,'',NOW(),NOW(),0,0),
(178,NULL,NULL,'rsync',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,873,873,NULL,'',NOW(),NOW(),0,0),
(179,NULL,NULL,'SSDP',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1900,1900,NULL,'Simple Service Discovery Protocol (used for UPnP)',NOW(),NOW(),0,0),
(180,NULL,NULL,'OpenVPN',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1194,1194,NULL,'',NOW(),NOW(),0,0),

-- ADDRESS (IDs from 50000 to 59999) 
(3,NULL,NULL,'all-hosts',5,NULL,'224.0.0.1','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(4,NULL,NULL,'all-routers',5,NULL,'224.0.0.2','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(5,NULL,NULL,'all DVMRP',5,NULL,'224.0.0.4','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(6,NULL,NULL,'OSPF (all routers)',5,NULL,'224.0.0.5','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC2328',NOW(),NOW(),0,0),
(7,NULL,NULL,'OSPF (designated routers)',5,NULL,'224.0.0.6','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC2328',NOW(),NOW(),0,0),
(8,NULL,NULL,'RIP',5,NULL,'224.0.0.9','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC1723',NOW(),NOW(),0,0),
(9,NULL,NULL,'EIGRP',5,NULL,'224.0.0.10','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(10,NULL,NULL,'DHCP server, relay agent',5,NULL,'224.0.0.12','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC 1884',NOW(),NOW(),0,0),
(11,NULL,NULL,'PIM',5,NULL,'224.0.0.13','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(12,NULL,NULL,'RSVP',5,NULL,'224.0.0.14','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(13,NULL,NULL,'VRRP',5,NULL,'224.0.0.18','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC3768',NOW(),NOW(),0,0),
(14,NULL,NULL,'IGMP',5,NULL,'224.0.0.22','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(15,NULL,NULL,'OSPFIGP-TE',5,NULL,'224.0.0.24','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC4973',NOW(),NOW(),0,0),
(16,NULL,NULL,'HSRP',5,NULL,'224.0.0.102','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(17,NULL,NULL,'mDNS',5,NULL,'224.0.0.251','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(18,NULL,NULL,'LLMNR',5,NULL,'224.0.0.252','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Link-Local Multicast Name Resolution, RFC4795',NOW(),NOW(),0,0),
(19,NULL,NULL,'Teredo',5,NULL,'224.0.0.253','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),

-- ADDRESS RANGE (IDs from 60000 to 69999)
(20,NULL,NULL,'broadcast',6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'255.255.255.255','255.255.255.255',0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(21,NULL,NULL,'old-broadcast',6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0.0.0.0','0.0.0.0',0,0,0,0,NULL,'',NOW(),NOW(),0,0),

-- NETWORK (ID from 70000 to 79999)
(22,NULL,NULL,'all multicasts',7,NULL,'224.0.0.0','240.0.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'224.0.0.0/4 - This block, formerly known as the Class D address\nspace, is allocated for use in IPv4 multicast address assignments.\nThe IANA guidelines for assignments from this space are described in\n[RFC3171].\n',NOW(),NOW(),0,0),
(23,NULL,NULL,'link-local',7,NULL,'169.254.0.0','255.255.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'169.254.0.0/16 - This is the \"link local\" block.  It is allocated for\ncommunication between hosts on a single link.  Hosts obtain these\naddresses by auto-configuration, such as when a DHCP server may not\nbe found.\n',NOW(),NOW(),0,0),
(24,NULL,NULL,'loopback-net',7,NULL,'127.0.0.0','255.0.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'127.0.0.0/8 - This block is assigned for use as the Internet host\nloopback address.  A datagram sent by a higher level protocol to an\naddress anywhere within this block should loop back inside the host.\nThis is ordinarily implemented using only 127.0.0.1/32 for loopback,\nbut no addresses within this block should ever appear on any network\nanywhere [RFC1700, page 5].\n',NOW(),NOW(),0,0),
(25,NULL,NULL,'net-10.0.0.0',7,NULL,'10.0.0.0','255.0.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'10.0.0.0/8 - This block is set aside for use in private networks.\nIts intended use is documented in [RFC1918].  Addresses within this\nblock should not appear on the public Internet.',NOW(),NOW(),0,0),
(26,NULL,NULL,'net-172.16.0.0',7,NULL,'172.16.0.0','255.240.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'172.16.0.0/12 - This block is set aside for use in private networks.\nIts intended use is documented in [RFC1918].  Addresses within this\nblock should not appear on the public Internet.\n',NOW(),NOW(),0,0),
(27,NULL,NULL,'net-192.168.0.0',7,NULL,'192.168.0.0','255.255.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'192.168.0.0/16 - This block is set aside for use in private networks.\nIts intended use is documented in [RFC1918].  Addresses within this\nblock should not appear on the public Internet.\n',NOW(),NOW(),0,0),
(28,NULL,NULL,'this-net',7,NULL,'0.0.0.0','255.0.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'0.0.0.0/8 - Addresses in this block refer to source hosts on \"this\"\nnetwork.  Address 0.0.0.0/32 may be used as a source address for this\nhost on this network; other addresses within 0.0.0.0/8 may be used to\nrefer to specified hosts on this network [RFC1700, page 4].',NOW(),NOW(),0,0),
(29,NULL,NULL,'net-192.168.1.0',7,NULL,'192.168.1.0','255.255.255.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'192.168.1.0/24 - Address often used for home and small office networks.\n',NOW(),NOW(),0,0),
(30,NULL,NULL,'net-192.168.2.0',7,NULL,'192.168.2.0','255.255.255.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'192.168.2.0/24 - Address often used for home and small office networks.\n',NOW(),NOW(),0,0),
(31,NULL,NULL,'Benchmark tests network',7,NULL,'198.18.0.0','255.254.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC 5735',NOW(),NOW(),0,0),
(32,NULL,NULL,'documentation net',7,NULL,'2001:db8::','32',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC3849',NOW(),NOW(),0,0),
(33,NULL,NULL,'link-local ipv6',7,NULL,'fe80::','10',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC4291   Link-local unicast net',NOW(),NOW(),0,0),
(34,NULL,NULL,'multicast ipv6',7,NULL,'ff00::','8',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC4291  ipv6 multicast addresses',NOW(),NOW(),0,0),
(35,NULL,NULL,'experimental ipv6',7,NULL,'2001::','23',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC2928, RFC4773 \n\n\"The block of Sub-TLA IDs assigned to the IANA\n(i.e., 2001:0000::/29 - 2001:01F8::/29) is for\nassignment for testing and experimental usage to\nsupport activities such as the 6bone, and\nfor new approaches like exchanges.\"  [RFC2928]\n\n',NOW(),NOW(),0,0),
(36,NULL,NULL,'mapped-ipv4',7,NULL,'::ffff:0.0.0.0','96',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(37,NULL,NULL,'translated-ipv4',7,NULL,'::ffff:0:0:0','96',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(38,NULL,NULL,'Teredo',7,NULL,'2001::','32',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0),
(39,NULL,NULL,'unique-local',7,NULL,'fc00::','7',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'',NOW(),NOW(),0,0);


-- mysql> describe ipobj_g;
-- +------------+--------------+------+-----+-------------------+-----------------------------+
-- | Field      | Type         | Null | Key | Default           | Extra                       |
-- +------------+--------------+------+-----+-------------------+-----------------------------+
-- | id         | int(11)      | NO   | PRI | NULL              | auto_increment              |
-- | name       | varchar(255) | NO   |     | NULL              |                             |
-- | type       | tinyint(2)   | NO   |     | NULL              |                             |
-- | fwcloud    | int(11)      | YES  |     | 0                 |                             |
-- | created_at | datetime     | NO   |     | CURRENT_TIMESTAMP |                             |
-- | updated_at | datetime     | NO   |     | CURRENT_TIMESTAMP | on update CURRENT_TIMESTAMP |
-- | created_by | int(11)      | NO   |     | 0                 |                             |
-- | updated_by | int(11)      | NO   |     | 0                 |                             |
-- | comment    | longtext     | YES  |     | NULL              |                             |
-- +------------+--------------+------+-----+-------------------+-----------------------------+
INSERT INTO `ipobj_g` VALUES 
(1,'rfc1918-nets',20,NULL,NOW(),NOW(),0,0,NULL),
(2,'ipv6 private',20,NULL,NOW(),NOW(),0,0,NULL);


-- mysql> describe ipobj__ipobjg;
-- +------------+----------+------+-----+-------------------+-----------------------------+
-- | Field      | Type     | Null | Key | Default           | Extra                       |
-- +------------+----------+------+-----+-------------------+-----------------------------+
-- | id_gi      | int(11)  | NO   | PRI | NULL              | auto_increment              |
-- | ipobj_g    | int(11)  | NO   | MUL | NULL              |                             |
-- | ipobj      | int(11)  | NO   | MUL | NULL              |                             |
-- | created_at | datetime | NO   |     | CURRENT_TIMESTAMP |                             |
-- | updated_at | datetime | NO   |     | CURRENT_TIMESTAMP | on update CURRENT_TIMESTAMP |
-- | created_by | int(11)  | NO   |     | 0                 |                             |
-- | updated_by | int(11)  | NO   |     | 0                 |                             |
-- +------------+----------+------+-----+-------------------+-----------------------------+
INSERT INTO `ipobj__ipobjg` VALUES 
(1,1,25,NOW(),NOW(),0,0),
(2,1,27,NOW(),NOW(),0,0),
(3,1,26,NOW(),NOW(),0,0),
(4,2,32,NOW(),NOW(),0,0),
(5,2,35,NOW(),NOW(),0,0),
(6,2,33,NOW(),NOW(),0,0);
