-- MySQL dump 10.13  Distrib 5.7.24, for Linux (x86_64)
--
-- Host: localhost    Database: fwcloud
-- ------------------------------------------------------
-- Server version	5.7.24-0ubuntu0.16.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ca`
--

DROP TABLE IF EXISTS `ca`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ca` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fwcloud` int(11) NOT NULL,
  `cn` varchar(255) NOT NULL,
  `days` int(11) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_id-cn` (`id`,`cn`),
  KEY `idx_fwcloud` (`fwcloud`),
  CONSTRAINT `fk_ca-fwcloud` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ca`
--

LOCK TABLES `ca` WRITE;
/*!40000 ALTER TABLE `ca` DISABLE KEYS */;
/*!40000 ALTER TABLE `ca` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cluster`
--

DROP TABLE IF EXISTS `cluster`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cluster` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fwcloud` int(11) NOT NULL,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `comment` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_fwcloud` (`fwcloud`) USING BTREE,
  CONSTRAINT `fk_cluster-fwcloud` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cluster`
--

LOCK TABLES `cluster` WRITE;
/*!40000 ALTER TABLE `cluster` DISABLE KEYS */;
/*!40000 ALTER TABLE `cluster` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `crt`
--

DROP TABLE IF EXISTS `crt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `crt` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ca` int(11) NOT NULL,
  `cn` varchar(255) NOT NULL,
  `days` int(11) unsigned NOT NULL,
  `type` tinyint(1) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_ca-cn` (`ca`,`cn`),
  KEY `idx_ca` (`ca`),
  CONSTRAINT `fk_crt-ca` FOREIGN KEY (`ca`) REFERENCES `ca` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `crt`
--

LOCK TABLES `crt` WRITE;
/*!40000 ALTER TABLE `crt` DISABLE KEYS */;
/*!40000 ALTER TABLE `crt` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer`
--

DROP TABLE IF EXISTS `customer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `address` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `CIF` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `telephone` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `web` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer`
--

LOCK TABLES `customer` WRITE;
/*!40000 ALTER TABLE `customer` DISABLE KEYS */;
INSERT INTO `customer` VALUES (1,'SOLTECSIS, S.L.','C/Carrasca 7','B54368451','966 446 046','info@soltecsis.com','soltecsis.com','0000-00-00 00:00:00','0000-00-00 00:00:00',0,0);
/*!40000 ALTER TABLE `customer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `firewall`
--

DROP TABLE IF EXISTS `firewall`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `firewall` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cluster` int(11) DEFAULT NULL,
  `fwcloud` int(11) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `comment` longtext CHARACTER SET utf8,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `compiled_at` datetime DEFAULT NULL,
  `installed_at` datetime DEFAULT NULL,
  `by_user` int(11) NOT NULL DEFAULT '0',
  `status` tinyint(1) NOT NULL DEFAULT '0',
  `install_user` varchar(250) COLLATE utf8_unicode_ci DEFAULT NULL,
  `install_pass` varchar(250) COLLATE utf8_unicode_ci DEFAULT NULL,
  `save_user_pass` tinyint(1) NOT NULL DEFAULT '1',
  `install_interface` int(11) DEFAULT NULL,
  `install_ipobj` int(11) DEFAULT NULL,
  `fwmaster` tinyint(1) NOT NULL DEFAULT '0',
  `install_port` int(11) NOT NULL DEFAULT '22',
  `options` smallint(2) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_fwcloud` (`fwcloud`),
  KEY `idx_cluster` (`cluster`),
  CONSTRAINT `fk_firewall-cluster` FOREIGN KEY (`cluster`) REFERENCES `cluster` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_firewall-fwcloud` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `firewall`
--

LOCK TABLES `firewall` WRITE;
/*!40000 ALTER TABLE `firewall` DISABLE KEYS */;
/*!40000 ALTER TABLE `firewall` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`firewall_AFTER_INSERT` AFTER INSERT ON `firewall` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.fwcloud;    
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`firewall_AFTER_UPDATE` AFTER UPDATE ON `firewall` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.fwcloud;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`firewall_AFTER_DELETE` AFTER DELETE ON `firewall` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at=CURRENT_TIMESTAMP WHERE id=OLD.fwcloud;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `fwc_tree`
--

DROP TABLE IF EXISTS `fwc_tree`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fwc_tree` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL,
  `id_parent` int(11) DEFAULT NULL,
  `node_order` tinyint(2) NOT NULL DEFAULT '0',
  `node_type` char(3) DEFAULT NULL,
  `id_obj` int(11) DEFAULT NULL,
  `obj_type` int(11) DEFAULT NULL,
  `fwcloud` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_id_parent-node_type-id_obj-obj_type` (`id_obj`,`obj_type`,`id_parent`,`node_type`),
  KEY `idx_id_parent` (`id_parent`),
  KEY `idx_id_obj` (`id_obj`),
  KEY `idx_obj_type` (`obj_type`),
  KEY `idx_fwcloud` (`fwcloud`),
  KEY `idx_node_type` (`node_type`),
  CONSTRAINT `fk_fwc_tree-fwc_tree` FOREIGN KEY (`id_parent`) REFERENCES `fwc_tree` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_fwc_tree-fwcloud` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_fwc_tree-ipobj_type` FOREIGN KEY (`obj_type`) REFERENCES `ipobj_type` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fwc_tree`
--

LOCK TABLES `fwc_tree` WRITE;
/*!40000 ALTER TABLE `fwc_tree` DISABLE KEYS */;
/*!40000 ALTER TABLE `fwc_tree` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fwc_tree_node_types`
--

DROP TABLE IF EXISTS `fwc_tree_node_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fwc_tree_node_types` (
  `node_type` char(3) NOT NULL,
  `obj_type` int(11) DEFAULT NULL,
  `name` varchar(45) DEFAULT NULL,
  `api_call_base` varchar(255) DEFAULT NULL,
  `order_mode` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Node order: 1-NODE_ORDER , 2 - NAME',
  PRIMARY KEY (`node_type`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fwc_tree_node_types`
--

LOCK TABLES `fwc_tree_node_types` WRITE;
/*!40000 ALTER TABLE `fwc_tree_node_types` DISABLE KEYS */;
INSERT INTO `fwc_tree_node_types` VALUES ('CA',NULL,'CA',NULL,2),('CL',NULL,'Cluster',NULL,1),('CRT',NULL,'Certificate',NULL,2),('FCA',NULL,'Folder CA',NULL,2),('FCF',NULL,'Folder Cluster Firewalls',NULL,2),('FCR',NULL,'Folder CRT',NULL,2),('FD',NULL,'Folder',NULL,1),('FDC',NULL,'Folder Clusters',NULL,2),('FDF',NULL,'Folder Firewalls',NULL,2),('FDI',10,'Folder Interfaces',NULL,2),('FDO',NULL,'Folder Objects',NULL,1),('FDS',NULL,'Folder Services',NULL,1),('FDT',NULL,'Folder Times',NULL,1),('FP',NULL,'FILTER POLICIES',NULL,1),('FW',NULL,'Firewall',NULL,1),('IFF',10,'Interfaces Firewalls',NULL,2),('IFH',11,'Interfaces Host',NULL,2),('NT',NULL,'NAT Rules',NULL,1),('NTD',NULL,'DNAT Rules',NULL,1),('NTS',NULL,'SNAT Rules',NULL,1),('OIA',5,'IP Address Objects',NULL,2),('OIG',20,'Objects Groups',NULL,2),('OIH',8,'IP Host Objects',NULL,2),('OIN',7,'IP Network Objects',NULL,2),('OIR',6,'IP Address Range Objects',NULL,2),('PF',NULL,'Policy Forward Rules',NULL,1),('PI',NULL,'Policy IN Rules',NULL,1),('PO',NULL,'Policy OUT Rules',NULL,1),('RR',NULL,'Routing rules',NULL,1),('SOC',0,'Services Customs',NULL,2),('SOG',21,'Services Groups',NULL,2),('SOI',1,'IP Service Objects',NULL,2),('SOM',3,'ICMP Service Objects',NULL,2),('SOT',2,'TCP Service Objects',NULL,2),('SOU',4,'UDP Service Objects',NULL,2);
/*!40000 ALTER TABLE `fwc_tree_node_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fwcloud`
--

DROP TABLE IF EXISTS `fwcloud`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fwcloud` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  `locked_at` datetime DEFAULT NULL,
  `locked_by` int(11) DEFAULT NULL,
  `locked` tinyint(1) NOT NULL DEFAULT '0',
  `image` varchar(255) DEFAULT NULL,
  `comment` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fwcloud`
--

LOCK TABLES `fwcloud` WRITE;
/*!40000 ALTER TABLE `fwcloud` DISABLE KEYS */;
/*!40000 ALTER TABLE `fwcloud` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `interface`
--

DROP TABLE IF EXISTS `interface`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `interface` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `firewall` int(11) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `labelName` varchar(255) CHARACTER SET utf8 DEFAULT '',
  `type` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `interface_type` tinyint(2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  `comment` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `mac` varchar(45) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_firewall` (`firewall`),
  CONSTRAINT `fk_interface-firewall` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `interface`
--

LOCK TABLES `interface` WRITE;
/*!40000 ALTER TABLE `interface` DISABLE KEYS */;
/*!40000 ALTER TABLE `interface` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`interface_AFTER_INSERT` AFTER INSERT ON `interface` FOR EACH ROW
BEGIN
	UPDATE firewall set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.firewall;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`interface_AFTER_UPDATE` AFTER UPDATE ON `interface` FOR EACH ROW
BEGIN
	UPDATE policy_r__ipobj set updated_at=CURRENT_TIMESTAMP  WHERE interface=NEW.id ;
    UPDATE policy_r__interface set updated_at=CURRENT_TIMESTAMP  WHERE interface=NEW.id ;
    UPDATE interface__ipobj set updated_at=CURRENT_TIMESTAMP  WHERE interface=NEW.id ;
    UPDATE firewall set updated_at= URRENT_TIMESTAMP WHERE id=NEW.firewall;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`interface_AFTER_DELETE` AFTER DELETE ON `interface` FOR EACH ROW
BEGIN
	UPDATE firewall set updated_at=CURRENT_TIMESTAMP WHERE id=OLD.firewall;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `interface__ipobj`
--

DROP TABLE IF EXISTS `interface__ipobj`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `interface__ipobj` (
  `interface` int(11) NOT NULL,
  `ipobj` int(11) NOT NULL,
  `interface_order` varchar(45) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`interface`,`ipobj`),
  KEY `idx_ipobj` (`ipobj`),
  CONSTRAINT `fk_interface__ipobj-interface` FOREIGN KEY (`interface`) REFERENCES `interface` (`id`),
  CONSTRAINT `fk_interface__ipobj-ipobj` FOREIGN KEY (`ipobj`) REFERENCES `ipobj` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `interface__ipobj`
--

LOCK TABLES `interface__ipobj` WRITE;
/*!40000 ALTER TABLE `interface__ipobj` DISABLE KEYS */;
/*!40000 ALTER TABLE `interface__ipobj` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ipobj`
--

DROP TABLE IF EXISTS `ipobj`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ipobj` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fwcloud` int(11) DEFAULT NULL,
  `interface` int(11) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `type` int(11) NOT NULL,
  `protocol` tinyint(1) unsigned DEFAULT NULL,
  `address` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `netmask` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `diff_serv` tinyint(1) unsigned DEFAULT NULL,
  `ip_version` tinyint(1) unsigned DEFAULT NULL,
  `icmp_type` smallint(2) DEFAULT NULL,
  `icmp_code` smallint(2) DEFAULT NULL,
  `tcp_flags_mask` tinyint(1) unsigned DEFAULT NULL,
  `tcp_flags_settings` tinyint(1) unsigned DEFAULT NULL,
  `range_start` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `range_end` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `source_port_start` int(11) DEFAULT NULL,
  `source_port_end` int(11) DEFAULT NULL,
  `destination_port_start` int(11) DEFAULT NULL,
  `destination_port_end` int(11) DEFAULT NULL,
  `options` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `comment` longtext COLLATE utf8_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`) COMMENT '	',
  KEY `idx_fwcloud` (`fwcloud`),
  KEY `idx_interface` (`interface`),
  CONSTRAINT `fk_ipobj-fwcloud` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`),
  CONSTRAINT `fk_ipobj-interface` FOREIGN KEY (`interface`) REFERENCES `interface` (`id`),
  CONSTRAINT `fk_ipobj-ipobj_type` FOREIGN KEY (`type`) REFERENCES `ipobj_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=70018 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ipobj`
--

LOCK TABLES `ipobj` WRITE;
/*!40000 ALTER TABLE `ipobj` DISABLE KEYS */;
INSERT INTO `ipobj` VALUES (10000,NULL,NULL,'HOPOPT',1,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IPv6 Hop-by-Hop Option (RFC 8200)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10001,NULL,NULL,'ICMP',1,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Internet Control Message Protocol (RFC 792)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10002,NULL,NULL,'IGMP',1,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Internet Group Management Protocol (RFC 1112)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10003,NULL,NULL,'GGP',1,3,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Gateway-to-Gateway Protocol (RFC 823)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10004,NULL,NULL,'IP-in-IP',1,4,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IP in IP (encapsulation) (RFC 2003)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10005,NULL,NULL,'ST',1,5,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Internet Stream Protocol (RFC 1190, RFC 1819)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10006,NULL,NULL,'TCP',1,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Transmission Control Protocol (RFC 793)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10007,NULL,NULL,'CBT',1,7,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Core-based trees (RFC 2189)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10008,NULL,NULL,'EGP',1,8,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Exterior Gateway Protocol (RFC 888)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10009,NULL,NULL,'IGP',1,9,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Interior Gateway Protocol (any private interior gateway (used by Cisco for their IGRP)) ()','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10010,NULL,NULL,'BBN-RCC-MON',1,10,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'BBN RCC Monitoring','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10011,NULL,NULL,'NVP-II',1,11,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Network Voice Protocol (RFC 741)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10012,NULL,NULL,'PUP',1,12,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Xerox PUP','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10013,NULL,NULL,'ARGUS',1,13,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'ARGUS','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10014,NULL,NULL,'EMCON',1,14,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'EMCON','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10015,NULL,NULL,'XNET',1,15,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Cross Net Debugger (IEN 158)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10016,NULL,NULL,'CHAOS',1,16,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Chaos','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10017,NULL,NULL,'UDP',1,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'User Datagram Protocol (RFC 768)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10018,NULL,NULL,'MUX',1,18,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Multiplexing (IEN 90)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10019,NULL,NULL,'DCN-MEAS',1,19,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'DCN Measurement Subsystems','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10020,NULL,NULL,'HMP',1,20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Host Monitoring Protocol (RFC 869)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10021,NULL,NULL,'PRM',1,21,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Packet Radio Measurement','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10022,NULL,NULL,'XNS-IDP',1,22,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'XEROX NS IDP','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10023,NULL,NULL,'TRUNK-1',1,23,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Trunk-1','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10024,NULL,NULL,'TRUNK-2',1,24,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Trunk-2','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10025,NULL,NULL,'LEAF-1',1,25,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Leaf-1','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10026,NULL,NULL,'LEAF-2',1,26,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Leaf-2','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10027,NULL,NULL,'RDP',1,27,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Reliable Data Protocol (RFC 908)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10028,NULL,NULL,'IRTP',1,28,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Internet Reliable Transaction Protocol (RFC 938)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10029,NULL,NULL,'ISO-TP4',1,29,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'ISO Transport Protocol Class 4 (RFC 905)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10030,NULL,NULL,'NETBLT',1,30,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Bulk Data Transfer Protocol (RFC 998)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10031,NULL,NULL,'MFE-NSP',1,31,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'MFE Network Services Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10032,NULL,NULL,'MERIT-INP',1,32,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'MERIT Internodal Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10033,NULL,NULL,'DCCP',1,33,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Datagram Congestion Control Protocol (RFC 4340)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10034,NULL,NULL,'3PC',1,34,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Third Party Connect Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10035,NULL,NULL,'IDPR',1,35,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Inter-Domain Policy Routing Protocol (RFC 1479)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10036,NULL,NULL,'XTP',1,36,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Xpress Transport Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10037,NULL,NULL,'DDP',1,37,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Datagram Delivery Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10038,NULL,NULL,'IDPR-CMTP',1,38,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IDPR Control Message Transport Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10039,NULL,NULL,'TP++',1,39,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'TP++ Transport Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10040,NULL,NULL,'IL',1,40,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IL Transport Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10041,NULL,NULL,'IPv6',1,41,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IPv6 Encapsulation (RFC 2473)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10042,NULL,NULL,'SDRP',1,42,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Source Demand Routing Protocol (RFC 1940)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10043,NULL,NULL,'IPv6-Route',1,43,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Routing Header for IPv6 (RFC 8200)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10044,NULL,NULL,'IPv6-Frag',1,44,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Fragment Header for IPv6 (RFC 8200)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10045,NULL,NULL,'IDRP',1,45,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Inter-Domain Routing Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10046,NULL,NULL,'RSVP',1,46,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Resource Reservation Protocol (RFC 2205)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10047,NULL,NULL,'GREs',1,47,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Generic Routing Encapsulation (RFC 2784, RFC 2890)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10048,NULL,NULL,'DSR',1,48,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Dynamic Source Routing Protocol (RFC 4728)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10049,NULL,NULL,'BNA',1,49,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Burroughs Network Architecture','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10050,NULL,NULL,'ESP',1,50,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Encapsulating Security Payload (RFC 4303)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10051,NULL,NULL,'AH',1,51,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Authentication Header (RFC 4302)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10052,NULL,NULL,'I-NLSP',1,52,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Integrated Net Layer Security Protocol (TUBA)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10053,NULL,NULL,'SWIPE',1,53,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'SwIPe (IP with Encryption)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10054,NULL,NULL,'NARP',1,54,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'NBMA Address Resolution Protocol (RFC 1735)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10055,NULL,NULL,'MOBILE',1,55,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IP Mobility (Min Encap) (RFC 2004)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10056,NULL,NULL,'TLSP',1,56,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Transport Layer Security Protocol (using Kryptonet key management)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10057,NULL,NULL,'SKIP',1,57,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Simple Key-Management for Internet Protocol (RFC 2356)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10058,NULL,NULL,'IPv6-ICMP',1,58,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'ICMP for IPv6 (RFC 4443, RFC 4884)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10059,NULL,NULL,'IPv6-NoNxt',1,59,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'No Next Header for IPv6 (RFC 8200)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10060,NULL,NULL,'IPv6-Opts',1,60,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Destination Options for IPv6 (RFC 8200)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10061,NULL,NULL,'Any host internal protocol',1,61,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Any host internal protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10062,NULL,NULL,'CFTP',1,62,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'CFTP','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10063,NULL,NULL,'Any local network',1,63,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Any local network','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10064,NULL,NULL,'SAT-EXPAK',1,64,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'SATNET and Backroom EXPAK','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10065,NULL,NULL,'KRYPTOLAN',1,65,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Kryptolan','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10066,NULL,NULL,'RVD',1,66,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'MIT Remote Virtual Disk Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10067,NULL,NULL,'IPPC',1,67,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Internet Pluribus Packet Core','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10068,NULL,NULL,'Any distributed file system',1,68,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Any distributed file system','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10069,NULL,NULL,'SAT-MON',1,69,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'SATNET Monitoring','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10070,NULL,NULL,'VISA',1,70,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'VISA Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10071,NULL,NULL,'IPCU',1,71,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Internet Packet Core Utility','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10072,NULL,NULL,'CPNX',1,72,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Computer Protocol Network Executive','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10073,NULL,NULL,'CPHB',1,73,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Computer Protocol Heart Beat','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10074,NULL,NULL,'WSN',1,74,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Wang Span Network','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10075,NULL,NULL,'PVP',1,75,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Packet Video Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10076,NULL,NULL,'BR-SAT-MON',1,76,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Backroom SATNET Monitoring','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10077,NULL,NULL,'SUN-ND',1,77,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'SUN ND PROTOCOL-Temporary','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10078,NULL,NULL,'WB-MON',1,78,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'WIDEBAND Monitoring','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10079,NULL,NULL,'WB-EXPAK',1,79,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'WIDEBAND EXPAK','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10080,NULL,NULL,'ISO-IP',1,80,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'International Organization for Standardization Internet Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10081,NULL,NULL,'VMTP',1,81,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Versatile Message Transaction Protocol (RFC 1045)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10082,NULL,NULL,'SECURE-VMTP',1,82,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Secure Versatile Message Transaction Protocol (RFC 1045)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10083,NULL,NULL,'VINES',1,83,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'VINES','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10084,NULL,NULL,'TTP / IPTM',1,84,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Transaction Transport Protocol / Internet Protocol Traffic Manager','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10085,NULL,NULL,'NSFNET-IGP',1,85,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'NSFNET-IGP','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10086,NULL,NULL,'DGP',1,86,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Dissimilar Gateway Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10087,NULL,NULL,'TCF',1,87,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'TCF','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10088,NULL,NULL,'EIGRP',1,88,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'EIGRP','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10089,NULL,NULL,'OSPF',1,89,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Open Shortest Path First (RFC 1583)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10090,NULL,NULL,'Sprite-RPC',1,90,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Sprite RPC Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10091,NULL,NULL,'LARP',1,91,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Locus Address Resolution Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10092,NULL,NULL,'MTP',1,92,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Multicast Transport Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10093,NULL,NULL,'AX.25',1,93,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'AX.25','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10094,NULL,NULL,'OS',1,94,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'KA9Q NOS compatible IP over IP tunneling','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10095,NULL,NULL,'MICP',1,95,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Mobile Internetworking Control Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10096,NULL,NULL,'SCC-SP',1,96,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Semaphore Communications Sec. Pro','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10097,NULL,NULL,'ETHERIP',1,97,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Ethernet-within-IP Encapsulation (RFC 3378)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10098,NULL,NULL,'ENCAP',1,98,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Encapsulation Header (RFC 1241)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10099,NULL,NULL,'Any private encryption scheme',1,99,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Any private encryption scheme','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10100,NULL,NULL,'GMTP',1,100,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'GMTP','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10101,NULL,NULL,'IFMP',1,101,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Ipsilon Flow Management Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10102,NULL,NULL,'PNNI',1,102,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'PNNI over IP','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10103,NULL,NULL,'PIM',1,103,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Protocol Independent Multicast','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10104,NULL,NULL,'ARIS',1,104,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IBM\'s ARIS (Aggregate Route IP Switching) Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10105,NULL,NULL,'SCPS',1,105,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'SCPS (Space Communications Protocol Standards) (SCPS-TP[2])','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10106,NULL,NULL,'QNX',1,106,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'QNX','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10107,NULL,NULL,'A/N',1,107,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Active Networks','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10108,NULL,NULL,'IPComp',1,108,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IP Payload Compression Protocol (RFC 3173)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10109,NULL,NULL,'SNP',1,109,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Sitara Networks Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10110,NULL,NULL,'Compaq-Peer',1,110,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Compaq Peer Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10111,NULL,NULL,'IPX-in-IP',1,111,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IPX in IP','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10112,NULL,NULL,'VRRP',1,112,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Virtual Router Redundancy Protocol, Common Address Redundancy Protocol (not IANA assigned) (VRRP:RFC 3768)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10113,NULL,NULL,'PGM',1,113,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'PGM Reliable Transport Protocol (RFC 3208)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10114,NULL,NULL,'Any 0-hop protocol',1,114,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Any 0-hop protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10115,NULL,NULL,'L2TP',1,115,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Layer Two Tunneling Protocol Version 3 (RFC 3931)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10116,NULL,NULL,'DDX',1,116,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'D-II Data Exchange (DDX)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10117,NULL,NULL,'IATP',1,117,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Interactive Agent Transfer Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10118,NULL,NULL,'STP',1,118,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Schedule Transfer Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10119,NULL,NULL,'SRP',1,119,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'SpectraLink Radio Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10120,NULL,NULL,'UTI',1,120,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Universal Transport Interface Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10121,NULL,NULL,'SMP',1,121,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Simple Message Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10122,NULL,NULL,'SM',1,122,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Simple Multicast Protocol (draft-perlman-simple-multicast-03)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10123,NULL,NULL,'PTP',1,123,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Performance Transparency Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10124,NULL,NULL,'IS-IS over IPv4',1,124,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Intermediate System to Intermediate System (IS-IS) Protocol over IPv4 (RFC 1142 and RFC 1195)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10125,NULL,NULL,'FIRE',1,125,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Flexible Intra-AS Routing Environment','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10126,NULL,NULL,'CRTP',1,126,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Combat Radio Transport Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10127,NULL,NULL,'CRUDP',1,127,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Combat Radio User Datagram','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10128,NULL,NULL,'SSCOPMCE',1,128,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Service-Specific Connection-Oriented Protocol in a Multilink and Connectionless Environment (ITU-T Q.2111 (1999))','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10129,NULL,NULL,'IPLT',1,129,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IPLT','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10130,NULL,NULL,'SPS',1,130,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Secure Packet Shield','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10131,NULL,NULL,'PIPE',1,131,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Private IP Encapsulation within IP (Expired I-D draft-petri-mobileip-pipe-00.txt)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10132,NULL,NULL,'SCTP',1,132,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Stream Control Transmission Protocol (RFC 4960)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10133,NULL,NULL,'FC',1,133,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Fibre Channel','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10134,NULL,NULL,'RSVP-E2E-IGNORE',1,134,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Reservation Protocol (RSVP) End-to-End Ignore (RFC 3175)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10135,NULL,NULL,'Mobility Header',1,135,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Mobility Extension Header for IPv6 (RFC 6275)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10136,NULL,NULL,'UDPLite',1,136,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Lightweight User Datagram Protocol (RFC 3828)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10137,NULL,NULL,'MPLS-in-IP',1,137,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Multiprotocol Label Switching Encapsulated in IP (RFC 4023, RFC 5332)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10138,NULL,NULL,'manet',1,138,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'MANET Protocols (RFC 5498)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10139,NULL,NULL,'HIP',1,139,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Host Identity Protocol (RFC 5201)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10140,NULL,NULL,'Shim6',1,140,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Site Multihoming by IPv6 Intermediation (RFC 5533)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10141,NULL,NULL,'WESP',1,141,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Wrapped Encapsulating Security Payload (RFC 5840)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10142,NULL,NULL,'ROHC',1,142,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Robust Header Compression (RFC 5856)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20000,NULL,NULL,'nrpe',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5666,5666,NULL,'NRPE add-on for Nagios  http://www.nagios.org/\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20001,NULL,NULL,'xmas scan - full',2,6,NULL,NULL,NULL,NULL,NULL,NULL,63,63,NULL,NULL,0,0,0,0,NULL,'This service object matches TCP packet with all six flags set.','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20002,NULL,NULL,'xmas scan',2,6,NULL,NULL,NULL,NULL,NULL,NULL,37,37,NULL,NULL,0,0,0,0,NULL,'This service object matches TCP packet with flags FIN, PSH and URG set and other flags cleared. This is a  \"christmas scan\" as defined in snort rules. Nmap can generate this scan, too.','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20003,NULL,NULL,'AOL',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5190,5190,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20004,NULL,NULL,'Citrix-ICA',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1494,1494,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20005,NULL,NULL,'Entrust-Admin',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,709,709,NULL,'Entrust CA Administration Service','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20006,NULL,NULL,'Entrust-KeyMgmt',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,710,710,NULL,'Entrust CA Key Management Service','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20007,NULL,NULL,'H323',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1720,1720,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20008,NULL,NULL,'icslap',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2869,2869,NULL,'Sometimes this protocol is called icslap, but Microsoft does not call it that and just says that DSPP uses port 2869 in Windows XP SP2','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20009,NULL,NULL,'LDAP GC',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3268,3268,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20010,NULL,NULL,'LDAP GC SSL',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3269,3269,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20011,NULL,NULL,'OpenWindows',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2000,2000,NULL,'Open Windows','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20012,NULL,NULL,'PCAnywhere-data',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5631,5631,NULL,'data channel for PCAnywhere v7.52 and later ','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20013,NULL,NULL,'Real-Audio',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,7070,7070,NULL,'RealNetworks PNA Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20014,NULL,NULL,'RealSecure',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2998,2998,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20015,NULL,NULL,'SMB',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,445,445,NULL,'SMB over TCP (without NETBIOS)\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20016,NULL,NULL,'TACACSplus',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,49,49,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20017,NULL,NULL,'TCP high ports',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1024,65535,NULL,'TCP high ports','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20018,NULL,NULL,'WINS replication',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,42,42,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20019,NULL,NULL,'X11',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,6000,6063,NULL,'X Window System','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20020,NULL,NULL,'auth',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,113,113,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20021,NULL,NULL,'daytime',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,13,13,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20022,NULL,NULL,'domain',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,53,53,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20023,NULL,NULL,'eklogin',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2105,2105,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20024,NULL,NULL,'finger',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,79,79,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20025,NULL,NULL,'ftp',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,21,21,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20026,NULL,NULL,'ftp data',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,20,20,1024,65535,NULL,'FTP data channel.\n  Note: FTP protocol does not really require server to use source port 20 for the data channel, \n  but many ftp server implementations do so.','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20027,NULL,NULL,'ftp data passive',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,20,20,NULL,'FTP data channel for passive mode transfers\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20028,NULL,NULL,'http',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,80,80,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20029,NULL,NULL,'https',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,443,443,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20030,NULL,NULL,'imap',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,143,143,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20031,NULL,NULL,'imaps',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,993,993,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20032,NULL,NULL,'irc',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,6667,6667,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20033,NULL,NULL,'kerberos',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,88,88,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20034,NULL,NULL,'klogin',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,543,543,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20035,NULL,NULL,'ksh',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,544,544,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20036,NULL,NULL,'ldap',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,389,389,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20037,NULL,NULL,'ldaps',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,636,636,NULL,'Lightweight Directory Access Protocol over TLS/SSL','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20038,NULL,NULL,'linuxconf',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,98,98,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20039,NULL,NULL,'lpr',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,515,515,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20040,NULL,NULL,'microsoft-rpc',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,135,135,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20041,NULL,NULL,'ms-sql',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1433,1433,NULL,'Microsoft SQL Server','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20042,NULL,NULL,'mysql',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3306,3306,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20043,NULL,NULL,'netbios-ssn',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,139,139,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20044,NULL,NULL,'nfs',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2049,2049,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20045,NULL,NULL,'nntp',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,119,119,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20046,NULL,NULL,'nntps',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,563,563,NULL,'NNTP over SSL','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20047,NULL,NULL,'pop3',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,110,110,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20048,NULL,NULL,'pop3s',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,995,995,NULL,'POP-3 over SSL','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20049,NULL,NULL,'postgres',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5432,5432,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20050,NULL,NULL,'printer',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,515,515,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20051,NULL,NULL,'quake',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,26000,26000,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20052,NULL,NULL,'rexec',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,512,512,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20053,NULL,NULL,'rlogin',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,513,513,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20054,NULL,NULL,'rshell',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,514,514,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20055,NULL,NULL,'rtsp',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,554,554,NULL,'Real Time Streaming Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20056,NULL,NULL,'rwhois',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,4321,4321,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20057,NULL,NULL,'securidprop',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5510,5510,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20058,NULL,NULL,'smtp',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,25,25,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20059,NULL,NULL,'smtps',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,465,465,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20060,NULL,NULL,'socks',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1080,1080,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20061,NULL,NULL,'sqlnet1',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1521,1521,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20062,NULL,NULL,'squid',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3128,3128,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20063,NULL,NULL,'ssh',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,22,22,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20064,NULL,NULL,'sunrpc',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,111,111,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20065,NULL,NULL,'tcp-syn',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20066,NULL,NULL,'telnet',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,23,23,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20067,NULL,NULL,'uucp',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,540,540,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20068,NULL,NULL,'winterm',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3389,3389,NULL,'Windows Terminal Services','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20069,NULL,NULL,'xfs',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,7100,7100,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20070,NULL,NULL,'rsync',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,873,873,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20071,NULL,NULL,'distcc',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3632,3632,NULL,'distributed compiler','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20072,NULL,NULL,'cvspserver',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2401,2401,NULL,'CVS client/server operations','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20073,NULL,NULL,'cvsup',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5999,5999,NULL,'CVSup file transfer/John Polstra/FreeBSD','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20074,NULL,NULL,'afp',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,548,548,NULL,'AFP (Apple file sharing) over TCP','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20075,NULL,NULL,'whois',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,43,43,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20076,NULL,NULL,'bgp',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,179,179,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20077,NULL,NULL,'radius',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1812,1812,NULL,'Radius protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20078,NULL,NULL,'radius acct',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1813,1813,NULL,'Radius Accounting','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20079,NULL,NULL,'upnp',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5000,5000,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20080,NULL,NULL,'upnp-5431',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5431,5431,NULL,'Although UPnP specification say it should use TCP port 5000, Linksys running Sveasoft firmware listens on port 5431','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20081,NULL,NULL,'vnc-java-0',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5800,5800,NULL,'Java VNC viewer, display 0','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20082,NULL,NULL,'vnc-0',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5900,5900,NULL,'Regular VNC viewer, display 0','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20083,NULL,NULL,'vnc-java-1',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5801,5801,NULL,'Java VNC viewer, display 1','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20084,NULL,NULL,'vnc-1',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5901,5901,NULL,'Regular VNC viewer, display 1','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20085,NULL,NULL,'rtmp',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1935,1935,NULL,'Real Time Messaging Protocol','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20086,NULL,NULL,'xmpp-client',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5222,5222,NULL,'Extensible Messaging and Presence Protocol (XMPP)   RFC3920\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20087,NULL,NULL,'xmpp-server',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5269,5269,NULL,'Extensible Messaging and Presence Protocol (XMPP)   RFC3920\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20088,NULL,NULL,'xmpp-client-ssl',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5223,5223,NULL,'Extensible Messaging and Presence Protocol (XMPP)   RFC3920\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(20089,NULL,NULL,'xmpp-server-ssl',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5270,5270,NULL,'Extensible Messaging and Presence Protocol (XMPP)   RFC3920\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30000,NULL,NULL,'Any ICMP',3,1,NULL,NULL,NULL,NULL,-1,-1,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30001,NULL,NULL,'Echo Reply',3,1,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Echo reply (ping answer)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30002,NULL,NULL,'All Destination Unreachable',3,1,NULL,NULL,NULL,NULL,3,-1,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30003,NULL,NULL,'Destination network unreachable',3,1,NULL,NULL,NULL,NULL,3,0,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30004,NULL,NULL,'Destination host unreachable',3,1,NULL,NULL,NULL,NULL,3,1,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30005,NULL,NULL,'Destination protocol unreachable',3,1,NULL,NULL,NULL,NULL,3,2,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30006,NULL,NULL,'Destination port unreachable',3,1,NULL,NULL,NULL,NULL,3,3,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30007,NULL,NULL,'Fragmentation required, and DF flag set',3,1,NULL,NULL,NULL,NULL,3,4,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30008,NULL,NULL,'Source route failed',3,1,NULL,NULL,NULL,NULL,3,5,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30009,NULL,NULL,'Destination network unknown',3,1,NULL,NULL,NULL,NULL,3,6,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30010,NULL,NULL,'Destination host unknown',3,1,NULL,NULL,NULL,NULL,3,7,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30011,NULL,NULL,'Source host isolated',3,1,NULL,NULL,NULL,NULL,3,8,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30012,NULL,NULL,'Network administratively prohibited',3,1,NULL,NULL,NULL,NULL,3,9,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30013,NULL,NULL,'Host administratively prohibited',3,1,NULL,NULL,NULL,NULL,3,10,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30014,NULL,NULL,'Network unreachable for ToS',3,1,NULL,NULL,NULL,NULL,3,11,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30015,NULL,NULL,'Host unreachable for ToS',3,1,NULL,NULL,NULL,NULL,3,12,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30016,NULL,NULL,'Communication administratively prohibited',3,1,NULL,NULL,NULL,NULL,3,13,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30017,NULL,NULL,'Host Precedence Violation',3,1,NULL,NULL,NULL,NULL,3,14,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30018,NULL,NULL,'Precedence cutoff in effect',3,1,NULL,NULL,NULL,NULL,3,15,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30019,NULL,NULL,'All Redirect Message',3,1,NULL,NULL,NULL,NULL,5,-1,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30020,NULL,NULL,'Redirect Datagram for the Network',3,1,NULL,NULL,NULL,NULL,5,0,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30021,NULL,NULL,'Redirect Datagram for the Host',3,1,NULL,NULL,NULL,NULL,5,1,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30022,NULL,NULL,'Redirect Datagram for the ToS & network',3,1,NULL,NULL,NULL,NULL,5,2,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30023,NULL,NULL,'Redirect Datagram for the ToS & host',3,1,NULL,NULL,NULL,NULL,5,3,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30024,NULL,NULL,'Echo Request',3,1,NULL,NULL,NULL,NULL,8,0,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Echo request (ping request)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30025,NULL,NULL,'Router Advertisement',3,1,NULL,NULL,NULL,NULL,9,0,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30026,NULL,NULL,'Router Solicitation',3,1,NULL,NULL,NULL,NULL,10,0,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30027,NULL,NULL,'All Time Exceeded',3,1,NULL,NULL,NULL,NULL,11,-1,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30028,NULL,NULL,'TTL expired in transit',3,1,NULL,NULL,NULL,NULL,11,0,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30029,NULL,NULL,'Fragment reassembly time exceeded',3,1,NULL,NULL,NULL,NULL,11,1,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30030,NULL,NULL,'All Parameter Problem: Bad IP header',3,1,NULL,NULL,NULL,NULL,12,-1,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30031,NULL,NULL,'Pointer indicates the error',3,1,NULL,NULL,NULL,NULL,12,0,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30032,NULL,NULL,'Missing a required option',3,1,NULL,NULL,NULL,NULL,12,1,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30033,NULL,NULL,'Bad length',3,1,NULL,NULL,NULL,NULL,12,2,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30034,NULL,NULL,'Timestamp',3,1,NULL,NULL,NULL,NULL,13,0,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30035,NULL,NULL,'Timestamp Reply',3,1,NULL,NULL,NULL,NULL,14,0,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30036,NULL,NULL,'Extended Echo Request',3,1,NULL,NULL,NULL,NULL,42,0,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30037,NULL,NULL,'All Extended Echo Reply',3,1,NULL,NULL,NULL,NULL,43,-1,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30038,NULL,NULL,'Extended Echo Reply, No Error',3,1,NULL,NULL,NULL,NULL,43,0,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30039,NULL,NULL,'Extended Echo Reply, Malformed Query',3,1,NULL,NULL,NULL,NULL,43,1,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30040,NULL,NULL,'Extended Echo Reply, No Such Interface',3,1,NULL,NULL,NULL,NULL,43,2,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30041,NULL,NULL,'Extended Echo Reply, No Such Table Entry',3,1,NULL,NULL,NULL,NULL,43,3,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(30042,NULL,NULL,'Extended Echo Reply, Multiple Interfaces Satisfy Query',3,1,NULL,NULL,NULL,NULL,43,4,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40000,NULL,NULL,'ICQ',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,4000,4000,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40001,NULL,NULL,'IKE',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,500,500,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40002,NULL,NULL,'PCAnywhere-status',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5632,5632,NULL,'status channel for PCAnywhere v7.52 and later','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40003,NULL,NULL,'RIP',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,520,520,NULL,'routing protocol RIP','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40004,NULL,NULL,'Radius',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1645,1645,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40005,NULL,NULL,'UDP high ports',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1024,65535,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40006,NULL,NULL,'Who',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,513,513,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40007,NULL,NULL,'afs',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,7000,7009,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40008,NULL,NULL,'bootpc',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,68,68,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40009,NULL,NULL,'bootps',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,67,67,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40010,NULL,NULL,'daytime',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,13,13,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40011,NULL,NULL,'domain',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,53,53,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40012,NULL,NULL,'interphone',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,22555,22555,NULL,'VocalTec Internet Phone','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40013,NULL,NULL,'kerberos',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,88,88,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40014,NULL,NULL,'kerberos-adm',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,749,750,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40015,NULL,NULL,'kpasswd',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,464,464,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40016,NULL,NULL,'krb524',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,4444,4444,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40017,NULL,NULL,'microsoft-rpc',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,135,135,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40018,NULL,NULL,'netbios-dgm',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,138,138,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40019,NULL,NULL,'netbios-ns',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,137,137,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40020,NULL,NULL,'netbios-ssn',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,139,139,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40021,NULL,NULL,'nfs',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2049,2049,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40022,NULL,NULL,'ntp',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,123,123,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40023,NULL,NULL,'quake',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,26000,26000,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40024,NULL,NULL,'secureid-udp',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1024,1024,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40025,NULL,NULL,'snmp',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,161,161,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40026,NULL,NULL,'snmp-trap',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,162,162,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40027,NULL,NULL,'sunrpc',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,111,111,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40028,NULL,NULL,'syslog',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,514,514,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40029,NULL,NULL,'tftp',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,69,69,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40030,NULL,NULL,'traceroute',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,33434,33524,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40031,NULL,NULL,'rsync',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,873,873,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40032,NULL,NULL,'SSDP',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1900,1900,NULL,'Simple Service Discovery Protocol (used for UPnP)','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(40033,NULL,NULL,'OpenVPN',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1194,1194,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50000,NULL,NULL,'all-hosts',5,NULL,'224.0.0.1','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50001,NULL,NULL,'all-routers',5,NULL,'224.0.0.2','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50002,NULL,NULL,'all DVMRP',5,NULL,'224.0.0.4','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50003,NULL,NULL,'OSPF (all routers)',5,NULL,'224.0.0.5','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC2328','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50004,NULL,NULL,'OSPF (designated routers)',5,NULL,'224.0.0.6','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC2328','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50005,NULL,NULL,'RIP',5,NULL,'224.0.0.9','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC1723','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50006,NULL,NULL,'EIGRP',5,NULL,'224.0.0.10','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50007,NULL,NULL,'DHCP server, relay agent',5,NULL,'224.0.0.12','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC 1884','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50008,NULL,NULL,'PIM',5,NULL,'224.0.0.13','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50009,NULL,NULL,'RSVP',5,NULL,'224.0.0.14','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50010,NULL,NULL,'VRRP',5,NULL,'224.0.0.18','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC3768','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50011,NULL,NULL,'IGMP',5,NULL,'224.0.0.22','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50012,NULL,NULL,'OSPFIGP-TE',5,NULL,'224.0.0.24','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC4973','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50013,NULL,NULL,'HSRP',5,NULL,'224.0.0.102','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50014,NULL,NULL,'mDNS',5,NULL,'224.0.0.251','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50015,NULL,NULL,'LLMNR',5,NULL,'224.0.0.252','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Link-Local Multicast Name Resolution, RFC4795','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(50016,NULL,NULL,'Teredo',5,NULL,'224.0.0.253','0.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(60000,NULL,NULL,'broadcast',6,NULL,NULL,NULL,NULL,4,NULL,NULL,NULL,NULL,'255.255.255.255','255.255.255.255',0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(60001,NULL,NULL,'old-broadcast',6,NULL,NULL,NULL,NULL,4,NULL,NULL,NULL,NULL,'0.0.0.0','0.0.0.0',0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70000,NULL,NULL,'all multicasts',7,NULL,'224.0.0.0','240.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'224.0.0.0/4 - This block, formerly known as the Class D address\nspace, is allocated for use in IPv4 multicast address assignments.\nThe IANA guidelines for assignments from this space are described in\n[RFC3171].\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70001,NULL,NULL,'link-local',7,NULL,'169.254.0.0','255.255.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'169.254.0.0/16 - This is the \"link local\" block.  It is allocated for\ncommunication between hosts on a single link.  Hosts obtain these\naddresses by auto-configuration, such as when a DHCP server may not\nbe found.\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70002,NULL,NULL,'loopback-net',7,NULL,'127.0.0.0','255.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'127.0.0.0/8 - This block is assigned for use as the Internet host\nloopback address.  A datagram sent by a higher level protocol to an\naddress anywhere within this block should loop back inside the host.\nThis is ordinarily implemented using only 127.0.0.1/32 for loopback,\nbut no addresses within this block should ever appear on any network\nanywhere [RFC1700, page 5].\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70003,NULL,NULL,'net-10.0.0.0',7,NULL,'10.0.0.0','255.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'10.0.0.0/8 - This block is set aside for use in private networks.\nIts intended use is documented in [RFC1918].  Addresses within this\nblock should not appear on the public Internet.','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70004,NULL,NULL,'net-172.16.0.0',7,NULL,'172.16.0.0','255.240.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'172.16.0.0/12 - This block is set aside for use in private networks.\nIts intended use is documented in [RFC1918].  Addresses within this\nblock should not appear on the public Internet.\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70005,NULL,NULL,'net-192.168.0.0',7,NULL,'192.168.0.0','255.255.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'192.168.0.0/16 - This block is set aside for use in private networks.\nIts intended use is documented in [RFC1918].  Addresses within this\nblock should not appear on the public Internet.\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70006,NULL,NULL,'this-net',7,NULL,'0.0.0.0','255.0.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'0.0.0.0/8 - Addresses in this block refer to source hosts on \"this\"\nnetwork.  Address 0.0.0.0/32 may be used as a source address for this\nhost on this network; other addresses within 0.0.0.0/8 may be used to\nrefer to specified hosts on this network [RFC1700, page 4].','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70007,NULL,NULL,'net-192.168.1.0',7,NULL,'192.168.1.0','255.255.255.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'192.168.1.0/24 - Address often used for home and small office networks.\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70008,NULL,NULL,'net-192.168.2.0',7,NULL,'192.168.2.0','255.255.255.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'192.168.2.0/24 - Address often used for home and small office networks.\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70009,NULL,NULL,'Benchmark tests network',7,NULL,'198.18.0.0','255.254.0.0',NULL,4,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC 5735','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70010,NULL,NULL,'documentation net',7,NULL,'2001:db8::','32',NULL,6,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC3849','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70011,NULL,NULL,'link-local ipv6',7,NULL,'fe80::','10',NULL,6,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC4291   Link-local unicast net','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70012,NULL,NULL,'multicast ipv6',7,NULL,'ff00::','8',NULL,6,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC4291  ipv6 multicast addresses','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70013,NULL,NULL,'experimental ipv6',7,NULL,'2001::','23',NULL,6,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC2928, RFC4773 \n\n\"The block of Sub-TLA IDs assigned to the IANA\n(i.e., 2001:0000::/29 - 2001:01F8::/29) is for\nassignment for testing and experimental usage to\nsupport activities such as the 6bone, and\nfor new approaches like exchanges.\"  [RFC2928]\n\n','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70014,NULL,NULL,'mapped-ipv4',7,NULL,'::ffff:0.0.0.0','96',NULL,6,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70015,NULL,NULL,'translated-ipv4',7,NULL,'::ffff:0:0:0','96',NULL,6,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70016,NULL,NULL,'Teredo',7,NULL,'2001::','32',NULL,6,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(70017,NULL,NULL,'unique-local',7,NULL,'fc00::','7',NULL,6,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-11-16 17:16:12','2018-11-16 17:16:12',0,0);
/*!40000 ALTER TABLE `ipobj` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`ipobj_AFTER_INSERT` AFTER INSERT ON `ipobj` FOR EACH ROW
BEGIN
    UPDATE fwcloud set updated_at=CURRENT_TIMESTAMP  WHERE id=NEW.fwcloud;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`ipobj_AFTER_UPDATE` AFTER UPDATE ON `ipobj` FOR EACH ROW
BEGIN
	UPDATE policy_r__ipobj set updated_at=CURRENT_TIMESTAMP WHERE ipobj=NEW.id ;
    UPDATE ipobj__ipobjg  set updated_at=CURRENT_TIMESTAMP WHERE ipobj=NEW.id ;
	UPDATE fwcloud set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.fwcloud;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`ipobj_AFTER_DELETE` AFTER DELETE ON `ipobj` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at=CURRENT_TIMESTAMP WHERE id=OLD.fwcloud;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `ipobj__ipobjg`
--

DROP TABLE IF EXISTS `ipobj__ipobjg`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ipobj__ipobjg` (
  `id_gi` int(11) NOT NULL AUTO_INCREMENT,
  `ipobj_g` int(11) NOT NULL,
  `ipobj` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id_gi`),
  UNIQUE KEY `idx_ipobj_g-ipobj` (`ipobj_g`,`ipobj`),
  KEY `idx_ipobj_g` (`ipobj_g`),
  KEY `idx_ipobj` (`ipobj`),
  CONSTRAINT `fk_ipobj__ipobjg-ipobj` FOREIGN KEY (`ipobj`) REFERENCES `ipobj` (`id`),
  CONSTRAINT `fk_ipobj__ipobjg-ipobj_g` FOREIGN KEY (`ipobj_g`) REFERENCES `ipobj_g` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ipobj__ipobjg`
--

LOCK TABLES `ipobj__ipobjg` WRITE;
/*!40000 ALTER TABLE `ipobj__ipobjg` DISABLE KEYS */;
INSERT INTO `ipobj__ipobjg` VALUES (1,1,70003,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(2,1,70005,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(3,1,70004,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(4,2,70010,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(5,2,70013,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(6,2,70011,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(7,3,40008,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(8,3,40009,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(9,4,40018,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(10,4,40019,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(11,4,40020,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(12,4,20043,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(13,5,30002,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(14,5,30001,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(15,5,30028,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0),(16,5,30029,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0);
/*!40000 ALTER TABLE `ipobj__ipobjg` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`ipobj__ipobjg_AFTER_INSERT` AFTER INSERT ON `ipobj__ipobjg` FOR EACH ROW
BEGIN
	UPDATE ipobj_g set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.ipobj_g ;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`ipobj__ipobjg_AFTER_UPDATE` AFTER UPDATE ON `ipobj__ipobjg` FOR EACH ROW
BEGIN
	UPDATE ipobj_g set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.ipobj_g ;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`ipobj__ipobjg_AFTER_DELETE` AFTER DELETE ON `ipobj__ipobjg` FOR EACH ROW
BEGIN
	UPDATE ipobj_g set updated_at=CURRENT_TIMESTAMP WHERE id=OLD.ipobj_g ;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `ipobj_g`
--

DROP TABLE IF EXISTS `ipobj_g`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ipobj_g` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `type` tinyint(2) NOT NULL COMMENT '\n',
  `fwcloud` int(11) DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  `comment` longtext COLLATE utf8_unicode_ci,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ipobj_g`
--

LOCK TABLES `ipobj_g` WRITE;
/*!40000 ALTER TABLE `ipobj_g` DISABLE KEYS */;
INSERT INTO `ipobj_g` VALUES (1,'rfc1918-nets',20,NULL,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0,NULL),(2,'ipv6 private',20,NULL,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0,NULL),(3,'DHCP',21,NULL,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0,NULL),(4,'NETBIOS',21,NULL,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0,NULL),(5,'Useful ICMP',21,NULL,'2018-11-16 17:16:12','2018-11-16 17:16:12',0,0,NULL);
/*!40000 ALTER TABLE `ipobj_g` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`ipobj_g_AFTER_INSERT` AFTER INSERT ON `ipobj_g` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.fwcloud;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`ipobj_g_AFTER_UPDATE` AFTER UPDATE ON `ipobj_g` FOR EACH ROW
BEGIN
	UPDATE policy_r__ipobj set updated_at=CURRENT_TIMESTAMP WHERE ipobj_g=NEW.id ;
    UPDATE fwcloud set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.fwcloud;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`ipobj_g_AFTER_DELETE` AFTER DELETE ON `ipobj_g` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at=CURRENT_TIMESTAMP WHERE id=OLD.fwcloud;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `ipobj_type`
--

DROP TABLE IF EXISTS `ipobj_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ipobj_type` (
  `id` int(11) NOT NULL,
  `type` varchar(45) NOT NULL,
  `protocol_number` smallint(1) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ipobj_type`
--

LOCK TABLES `ipobj_type` WRITE;
/*!40000 ALTER TABLE `ipobj_type` DISABLE KEYS */;
INSERT INTO `ipobj_type` VALUES (0,'FIREWALL',NULL,'2017-07-10 13:30:26','2017-07-10 13:30:26',0,0),(1,'IP',NULL,'2017-02-21 12:39:51','2018-01-18 11:45:17',0,0),(2,'TCP',6,'2017-02-21 12:39:51','2018-01-18 12:51:48',0,0),(3,'ICMP',1,'2017-02-21 12:39:51','2018-01-18 12:51:48',0,0),(4,'UDP',17,'2017-02-21 12:39:51','2018-01-18 12:51:48',0,0),(5,'ADDRESS',NULL,'2017-02-21 12:39:51','2017-02-21 12:39:51',0,0),(6,'ADDRESS RANGE',NULL,'2017-02-21 12:39:51','2017-02-21 12:39:51',0,0),(7,'NETWORK',NULL,'2017-02-21 12:39:51','2017-02-21 12:39:51',0,0),(8,'HOST',NULL,'2017-06-23 15:31:19','2017-06-23 15:31:19',0,0),(10,'INTERFACE FIREWALL',NULL,'2017-06-19 16:16:29','2017-06-23 14:11:11',0,0),(11,'INTERFACE HOST',NULL,'2017-06-19 16:24:54','2017-06-19 16:24:54',0,0),(20,'GROUP OBJECTS',NULL,'2017-06-22 16:20:20','2017-06-22 16:20:20',0,0),(21,'GROUP SERVICES',NULL,'2017-06-22 16:20:20','2017-06-22 16:20:20',0,0),(100,'CLUSTER',NULL,'2018-03-12 13:27:52','2018-03-12 13:27:52',0,0);
/*!40000 ALTER TABLE `ipobj_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ipobj_type__policy_position`
--

DROP TABLE IF EXISTS `ipobj_type__policy_position`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ipobj_type__policy_position` (
  `type` int(11) NOT NULL,
  `position` int(11) NOT NULL,
  `allowed` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`type`,`position`),
  KEY `idx_position` (`position`),
  CONSTRAINT `fk_ipobj_type__policy_position-ipobj_type` FOREIGN KEY (`type`) REFERENCES `ipobj_type` (`id`),
  CONSTRAINT `fk_ipobj_type__policy_position-policy_position` FOREIGN KEY (`position`) REFERENCES `policy_position` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ipobj_type__policy_position`
--

LOCK TABLES `ipobj_type__policy_position` WRITE;
/*!40000 ALTER TABLE `ipobj_type__policy_position` DISABLE KEYS */;
INSERT INTO `ipobj_type__policy_position` VALUES (0,1,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,2,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,3,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,4,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,5,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,6,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,7,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,8,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,9,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,11,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,12,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,13,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,14,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,16,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,20,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,21,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,22,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,24,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(0,25,0,'2017-07-28 14:31:06','2017-07-28 14:31:06',0,0),(0,30,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(0,31,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(0,32,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(0,34,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(0,35,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(0,36,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(1,1,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(1,2,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(1,3,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(1,4,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(1,5,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(1,6,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(1,7,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(1,8,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(1,9,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(1,11,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(1,12,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(1,13,1,'2017-07-13 16:07:35','2018-04-19 13:46:11',0,0),(1,14,0,'2017-07-13 16:07:35','2018-04-20 10:28:15',0,0),(1,16,0,'2017-07-13 16:07:35','2018-03-15 13:56:25',0,0),(1,20,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(1,21,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(1,22,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(1,24,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(1,25,0,'2017-07-28 14:31:06','2017-07-28 14:31:06',0,0),(1,30,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(1,31,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(1,32,1,'2018-01-11 13:16:12','2018-04-19 13:46:11',0,0),(1,34,0,'2018-01-11 13:16:12','2018-04-20 10:28:15',0,0),(1,35,0,'2018-01-11 13:16:12','2018-03-15 13:56:25',0,0),(1,36,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(2,1,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,2,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,3,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(2,4,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,5,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,6,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(2,7,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,8,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,9,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(2,11,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,12,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,13,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(2,14,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,16,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(2,20,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,21,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,22,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,24,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(2,25,0,'2017-07-28 14:31:06','2017-07-28 14:31:06',0,0),(2,30,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(2,31,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(2,32,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(2,34,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(2,35,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(2,36,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(3,1,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,2,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,3,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(3,4,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,5,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,6,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(3,7,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,8,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,9,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(3,11,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,12,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,13,1,'2017-07-13 16:07:35','2018-04-19 13:46:11',0,0),(3,14,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,16,0,'2017-07-13 16:07:35','2018-03-15 13:56:25',0,0),(3,20,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,21,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,22,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,24,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(3,25,0,'2017-07-28 14:31:06','2017-07-28 14:31:06',0,0),(3,30,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(3,31,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(3,32,1,'2018-01-11 13:16:12','2018-04-19 13:46:11',0,0),(3,34,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(3,35,0,'2018-01-11 13:16:12','2018-03-15 13:56:25',0,0),(3,36,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(4,1,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,2,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,3,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(4,4,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,5,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,6,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(4,7,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,8,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,9,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(4,11,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,12,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,13,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(4,14,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,16,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(4,20,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,21,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,22,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,24,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(4,25,0,'2017-07-28 14:31:06','2017-07-28 14:31:06',0,0),(4,30,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(4,31,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(4,32,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(4,34,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(4,35,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(4,36,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(5,1,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(5,2,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(5,3,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(5,4,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(5,5,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(5,6,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(5,7,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(5,8,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(5,9,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(5,11,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(5,12,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(5,13,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(5,14,1,'2017-07-13 16:07:35','2018-04-20 10:28:15',0,0),(5,16,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(5,20,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(5,21,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(5,22,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(5,24,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(5,25,0,'2017-07-28 14:31:06','2017-07-28 14:31:06',0,0),(5,30,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(5,31,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(5,32,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(5,34,1,'2018-01-11 13:16:12','2018-04-20 10:28:15',0,0),(5,35,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(5,36,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(6,1,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(6,2,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(6,3,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(6,4,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(6,5,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(6,6,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(6,7,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(6,8,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(6,9,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(6,11,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(6,12,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(6,13,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(6,14,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(6,16,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(6,20,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(6,21,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(6,22,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(6,24,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(6,25,0,'2017-07-28 14:31:06','2017-07-28 14:31:06',0,0),(6,30,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(6,31,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(6,32,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(6,34,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(6,35,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(6,36,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(7,1,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(7,2,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(7,3,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(7,4,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(7,5,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(7,6,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(7,7,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(7,8,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(7,9,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(7,11,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(7,12,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(7,13,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(7,14,0,'2017-07-13 16:07:35','2018-04-19 13:43:24',0,0),(7,16,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(7,20,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(7,21,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(7,22,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(7,24,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(7,25,0,'2017-07-28 14:31:06','2017-07-28 14:31:06',0,0),(7,30,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(7,31,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(7,32,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(7,34,0,'2018-01-11 13:16:12','2018-04-19 13:43:24',0,0),(7,35,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(7,36,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(8,1,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(8,2,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(8,3,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(8,4,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(8,5,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(8,6,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(8,7,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(8,8,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(8,9,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(8,11,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(8,12,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(8,13,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(8,14,0,'2017-07-13 16:07:35','2018-04-19 13:43:24',0,0),(8,16,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(8,20,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(8,21,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(8,22,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(8,24,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(8,25,0,'2017-07-28 14:31:06','2017-07-28 14:31:06',0,0),(8,30,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(8,31,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(8,32,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(8,34,0,'2018-01-11 13:16:12','2018-04-19 13:43:24',0,0),(8,35,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(8,36,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(10,1,1,'2017-07-13 16:07:35','2017-09-04 13:11:26',0,0),(10,2,1,'2017-07-13 16:07:35','2017-09-04 13:11:26',0,0),(10,3,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(10,4,1,'2017-07-13 16:07:35','2017-09-04 13:11:26',0,0),(10,5,1,'2017-07-13 16:07:35','2017-09-04 13:11:26',0,0),(10,6,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(10,7,1,'2017-07-13 16:07:35','2017-09-04 13:11:26',0,0),(10,8,1,'2017-07-13 16:07:35','2017-09-04 13:11:26',0,0),(10,9,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(10,11,1,'2017-07-13 16:07:35','2017-09-04 13:11:26',0,0),(10,12,1,'2017-07-13 16:07:35','2017-09-04 13:11:26',0,0),(10,13,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(10,14,0,'2017-07-13 16:07:35','2018-04-19 13:43:24',0,0),(10,16,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(10,20,1,'2017-07-13 16:07:35','2017-10-30 17:08:06',0,0),(10,21,1,'2017-07-13 16:07:35','2017-10-30 17:08:06',0,0),(10,22,1,'2017-07-13 16:07:35','2017-10-30 17:08:06',0,0),(10,24,1,'2017-07-13 16:07:35','2017-10-30 17:08:06',0,0),(10,25,1,'2017-07-28 14:31:06','2017-10-30 17:08:06',0,0),(10,30,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(10,31,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(10,32,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(10,34,0,'2018-01-11 13:16:12','2018-04-19 13:43:24',0,0),(10,35,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(10,36,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(11,1,1,'2017-07-13 16:07:35','2017-09-04 13:12:03',0,0),(11,2,1,'2017-07-13 16:07:35','2017-09-04 13:12:03',0,0),(11,3,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(11,4,1,'2017-07-13 16:07:35','2017-09-04 13:12:03',0,0),(11,5,1,'2017-07-13 16:07:35','2017-09-04 13:12:03',0,0),(11,6,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(11,7,1,'2017-07-13 16:07:35','2017-09-04 13:12:03',0,0),(11,8,1,'2017-07-13 16:07:35','2017-09-04 13:12:03',0,0),(11,9,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(11,11,1,'2017-07-13 16:07:35','2017-09-04 13:12:03',0,0),(11,12,1,'2017-07-13 16:07:35','2017-09-04 13:12:03',0,0),(11,13,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(11,14,0,'2017-07-13 16:07:35','2018-04-19 13:43:24',0,0),(11,16,0,'2017-07-13 16:07:35','2017-07-13 16:23:55',0,0),(11,20,0,'2017-07-13 16:07:35','2017-10-30 16:33:27',0,0),(11,21,0,'2017-07-13 16:07:35','2017-10-30 16:33:27',0,0),(11,22,0,'2017-07-13 16:07:35','2017-10-30 16:33:27',0,0),(11,24,0,'2017-07-13 16:07:35','2017-10-30 16:33:27',0,0),(11,25,0,'2017-07-28 14:31:06','2017-10-30 16:33:28',0,0),(11,30,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(11,31,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(11,32,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(11,34,0,'2018-01-11 13:16:12','2018-04-19 13:43:24',0,0),(11,35,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(11,36,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(20,1,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(20,2,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(20,3,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(20,4,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(20,5,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(20,6,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(20,7,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(20,8,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(20,9,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(20,11,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(20,12,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(20,13,0,'2017-07-13 16:07:35','2018-03-15 13:56:25',0,0),(20,14,0,'2017-07-13 16:07:35','2018-04-19 13:43:24',0,0),(20,16,0,'2017-07-13 16:07:35','2018-03-15 13:56:25',0,0),(20,20,0,'2017-07-13 16:07:35','2017-10-30 17:08:35',0,0),(20,21,0,'2017-07-13 16:07:35','2017-10-30 17:08:35',0,0),(20,22,0,'2017-07-13 16:07:35','2017-10-30 17:08:35',0,0),(20,24,0,'2017-07-13 16:07:35','2017-10-30 17:08:35',0,0),(20,25,0,'2017-07-28 14:31:06','2017-10-30 17:08:35',0,0),(20,30,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(20,31,1,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(20,32,0,'2018-01-11 13:16:12','2018-03-15 13:56:25',0,0),(20,34,0,'2018-01-11 13:16:12','2018-04-19 13:43:24',0,0),(20,35,0,'2018-01-11 13:16:12','2018-03-15 13:56:25',0,0),(20,36,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0),(21,1,0,'2017-07-13 16:07:35','2018-02-05 17:10:32',0,0),(21,2,0,'2017-07-13 16:07:35','2018-02-05 17:10:32',0,0),(21,3,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(21,4,0,'2017-07-13 16:07:35','2018-02-05 17:10:32',0,0),(21,5,0,'2017-07-13 16:07:35','2018-02-05 17:10:32',0,0),(21,6,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(21,7,0,'2017-07-13 16:07:35','2018-02-05 17:10:32',0,0),(21,8,0,'2017-07-13 16:07:35','2018-02-05 17:10:32',0,0),(21,9,1,'2017-07-13 16:07:35','2017-07-13 16:07:35',0,0),(21,11,0,'2017-07-13 16:07:35','2018-02-05 17:10:32',0,0),(21,12,0,'2017-07-13 16:07:35','2018-02-05 17:10:33',0,0),(21,13,1,'2017-07-13 16:07:35','2018-03-29 16:14:24',0,0),(21,14,0,'2017-07-13 16:07:35','2018-02-05 17:10:33',0,0),(21,16,0,'2017-07-13 16:07:35','2018-04-20 10:29:15',0,0),(21,20,0,'2017-07-13 16:07:35','2017-10-30 17:08:35',0,0),(21,21,0,'2017-07-13 16:07:35','2017-10-30 17:08:35',0,0),(21,22,0,'2017-07-13 16:07:35','2017-10-30 17:08:35',0,0),(21,24,0,'2017-07-13 16:07:35','2017-10-30 17:08:35',0,0),(21,25,0,'2017-07-28 14:31:06','2017-10-30 17:08:35',0,0),(21,30,0,'2018-01-11 13:16:12','2018-02-05 17:10:33',0,0),(21,31,0,'2018-01-11 13:16:12','2018-02-05 17:10:33',0,0),(21,32,1,'2018-01-11 13:16:12','2018-03-29 16:14:24',0,0),(21,34,0,'2018-01-11 13:16:12','2018-02-05 17:10:33',0,0),(21,35,0,'2018-01-11 13:16:12','2018-04-20 10:29:15',0,0),(21,36,0,'2018-01-11 13:16:12','2018-01-11 13:16:12',0,0);
/*!40000 ALTER TABLE `ipobj_type__policy_position` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ipobj_type__routing_position`
--

DROP TABLE IF EXISTS `ipobj_type__routing_position`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ipobj_type__routing_position` (
  `type` int(11) NOT NULL,
  `position` int(11) NOT NULL,
  `allowed` tinyint(1) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`type`,`position`),
  KEY `idx_position` (`position`),
  CONSTRAINT `fk_ipobj_type__routing_position-ipobj_type` FOREIGN KEY (`type`) REFERENCES `ipobj_type` (`id`),
  CONSTRAINT `fk_ipobj_type__routing_position-routing_position` FOREIGN KEY (`position`) REFERENCES `routing_position` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ipobj_type__routing_position`
--

LOCK TABLES `ipobj_type__routing_position` WRITE;
/*!40000 ALTER TABLE `ipobj_type__routing_position` DISABLE KEYS */;
/*!40000 ALTER TABLE `ipobj_type__routing_position` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `openvpn_cfg`
--

DROP TABLE IF EXISTS `openvpn_cfg`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `openvpn_cfg` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `firewall` int(11) NOT NULL,
  `crt` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_firewall` (`firewall`),
  KEY `idx_crt` (`crt`),
  CONSTRAINT `fk_openvpn_cfg-crt` FOREIGN KEY (`crt`) REFERENCES `crt` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_openvpn_cfg-firewall` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `openvpn_cfg`
--

LOCK TABLES `openvpn_cfg` WRITE;
/*!40000 ALTER TABLE `openvpn_cfg` DISABLE KEYS */;
/*!40000 ALTER TABLE `openvpn_cfg` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `openvpn_opt`
--

DROP TABLE IF EXISTS `openvpn_opt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `openvpn_opt` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cfg` int(11) NOT NULL,
  `ipobj` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `arg` varchar(255) DEFAULT NULL,
  `scope` tinyint(1) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_openvpn_cfg` (`cfg`),
  KEY `idx_ipobj` (`ipobj`),
  CONSTRAINT `fk_openvpn_opt-ipobj` FOREIGN KEY (`ipobj`) REFERENCES `ipobj` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_openvpn_opt-openvpn_cfg` FOREIGN KEY (`cfg`) REFERENCES `openvpn_cfg` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `openvpn_opt`
--

LOCK TABLES `openvpn_opt` WRITE;
/*!40000 ALTER TABLE `openvpn_opt` DISABLE KEYS */;
/*!40000 ALTER TABLE `openvpn_opt` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `policy_c`
--

DROP TABLE IF EXISTS `policy_c`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `policy_c` (
  `rule` int(11) NOT NULL,
  `firewall` int(11) NOT NULL,
  `rule_compiled` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  `status_compiled` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`rule`),
  CONSTRAINT `fk_policy_c-policy_r` FOREIGN KEY (`rule`) REFERENCES `policy_r` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `policy_c`
--

LOCK TABLES `policy_c` WRITE;
/*!40000 ALTER TABLE `policy_c` DISABLE KEYS */;
/*!40000 ALTER TABLE `policy_c` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `policy_c_AFTER_INSERT` AFTER INSERT ON `policy_c` FOR EACH ROW BEGIN
  UPDATE firewall set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.firewall;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `policy_c_AFTER_UPDATE` AFTER UPDATE ON `policy_c` FOR EACH ROW BEGIN
  UPDATE firewall set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.firewall;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `policy_c_AFTER_DELETE` AFTER DELETE ON `policy_c` FOR EACH ROW BEGIN
  UPDATE firewall set updated_at=CURRENT_TIMESTAMP WHERE id=OLD.firewall;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `policy_g`
--

DROP TABLE IF EXISTS `policy_g`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `policy_g` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `firewall` int(11) NOT NULL,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `comment` longtext COLLATE utf8_unicode_ci NOT NULL,
  `idgroup` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  `groupstyle` varchar(50) CHARACTER SET utf8 DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_firewall` (`firewall`),
  KEY `idx_idgroup` (`idgroup`),
  CONSTRAINT `fk_policy_g-firewall` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`),
  CONSTRAINT `fk_policy_g-policy_g` FOREIGN KEY (`idgroup`) REFERENCES `policy_g` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `policy_g`
--

LOCK TABLES `policy_g` WRITE;
/*!40000 ALTER TABLE `policy_g` DISABLE KEYS */;
/*!40000 ALTER TABLE `policy_g` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_g_AFTER_INSERT` AFTER INSERT ON `policy_g` FOR EACH ROW
BEGIN
	UPDATE firewall set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.firewall;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_g_AFTER_UPDATE` AFTER UPDATE ON `policy_g` FOR EACH ROW
BEGIN
	UPDATE firewall set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.firewall;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_g_AFTER_DELETE` AFTER DELETE ON `policy_g` FOR EACH ROW
BEGIN
	UPDATE firewall set updated_at=CURRENT_TIMESTAMP WHERE id=OLD.firewall;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `policy_position`
--

DROP TABLE IF EXISTS `policy_position`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `policy_position` (
  `id` int(11) NOT NULL,
  `name` varchar(45) NOT NULL,
  `policy_type` tinyint(1) NOT NULL COMMENT 'R : Routing   P: Policy  N:Nat',
  `position_order` tinyint(2) DEFAULT NULL,
  `content` varchar(1) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  `single_object` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_policy_type-position_order` (`policy_type`,`position_order`),
  CONSTRAINT `fk_policy_position-policy_type` FOREIGN KEY (`policy_type`) REFERENCES `policy_type` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `policy_position`
--

LOCK TABLES `policy_position` WRITE;
/*!40000 ALTER TABLE `policy_position` DISABLE KEYS */;
INSERT INTO `policy_position` VALUES (1,'Source',1,2,'O','2017-02-21 12:41:19','2018-02-16 13:55:38',0,0,0),(2,'Destination',1,3,'O','2017-02-21 12:41:19','2018-02-16 13:55:38',0,0,0),(3,'Service',1,4,'O','2017-02-21 12:41:19','2018-02-16 13:55:38',0,0,0),(4,'Source',2,2,'O','2017-06-02 13:46:27','2018-02-16 13:57:20',0,0,0),(5,'Destination',2,3,'O','2017-06-02 13:46:27','2018-02-16 13:57:20',0,0,0),(6,'Service',2,4,'O','2017-06-02 13:46:27','2018-02-16 13:57:20',0,0,0),(7,'Source',3,3,'O','2017-06-02 13:46:27','2018-02-16 13:58:46',0,0,0),(8,'Destination',3,4,'O','2017-06-02 13:46:27','2018-02-16 13:58:46',0,0,0),(9,'Service',3,5,'O','2017-06-02 13:46:27','2018-02-16 13:58:46',0,0,0),(11,'Source',4,2,'O','2017-02-21 12:41:19','2018-01-11 12:52:38',0,0,0),(12,'Destination',4,3,'O','2017-02-21 12:41:19','2018-01-11 12:52:38',0,0,0),(13,'Service',4,4,'O','2017-02-21 12:41:19','2018-01-11 12:52:38',0,0,0),(14,'Translated Source',4,5,'O','2017-02-21 12:41:19','2018-05-23 17:31:08',0,0,1),(16,'Translated Service',4,6,'O','2017-02-21 12:41:19','2018-05-23 17:31:08',0,0,1),(20,'In',1,1,'I','2017-06-19 16:22:13','2018-02-16 14:04:03',0,0,0),(21,'Out',2,1,'I','2017-06-19 16:22:13','2018-02-16 14:04:03',0,0,0),(22,'In',3,1,'I','2017-06-19 16:22:13','2018-02-16 14:04:03',0,0,0),(24,'Out',4,1,'I','2017-06-19 16:22:13','2018-02-16 14:04:03',0,0,0),(25,'Out',3,2,'I','2017-07-28 14:02:13','2018-02-16 14:04:03',0,0,0),(30,'Source',5,2,'O','2018-01-11 11:33:02','2018-01-11 13:13:51',0,0,0),(31,'Destination',5,3,'O','2018-01-11 11:33:02','2018-01-11 13:13:51',0,0,0),(32,'Service',5,4,'O','2018-01-11 11:33:02','2018-01-11 13:13:51',0,0,0),(34,'Translated Destination',5,5,'O','2018-01-11 11:33:02','2018-05-23 17:31:08',0,0,1),(35,'Translated Service',5,6,'O','2018-01-11 11:33:02','2018-05-23 17:31:08',0,0,1),(36,'In',5,1,'I','2018-01-11 11:33:02','2018-02-16 14:04:03',0,0,0);
/*!40000 ALTER TABLE `policy_position` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `policy_r`
--

DROP TABLE IF EXISTS `policy_r`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `policy_r` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `idgroup` int(11) DEFAULT NULL,
  `firewall` int(11) DEFAULT NULL,
  `rule_order` int(11) NOT NULL,
  `direction` int(11) DEFAULT NULL,
  `action` int(11) NOT NULL,
  `time_start` datetime DEFAULT NULL,
  `time_end` datetime DEFAULT NULL,
  `comment` longtext COLLATE utf8_unicode_ci NOT NULL,
  `options` smallint(2) NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `type` tinyint(1) DEFAULT NULL COMMENT 'rule type:  I, O, F, N',
  `style` varchar(50) CHARACTER SET utf8 DEFAULT NULL,
  `fw_apply_to` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  `interface_negate` tinyint(1) NOT NULL DEFAULT '0',
  `fw_ref` varchar(45) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_policy_r_type_idx` (`type`),
  KEY `idx_idgroup` (`idgroup`),
  KEY `idx_firewall` (`firewall`),
  CONSTRAINT `fk_policy_r-firewall` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`),
  CONSTRAINT `fk_policy_r-policy_g` FOREIGN KEY (`idgroup`) REFERENCES `policy_g` (`id`),
  CONSTRAINT `fk_policy_r-policy_type` FOREIGN KEY (`type`) REFERENCES `policy_type` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `policy_r`
--

LOCK TABLES `policy_r` WRITE;
/*!40000 ALTER TABLE `policy_r` DISABLE KEYS */;
/*!40000 ALTER TABLE `policy_r` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `policy_r_AFTER_INSERT` AFTER INSERT ON `policy_r` FOR EACH ROW BEGIN
	UPDATE firewall set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.firewall;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `policy_r_AFTER_UPDATE` AFTER UPDATE ON `policy_r` FOR EACH ROW BEGIN
    UPDATE policy_c set status_compiled=0 WHERE rule=NEW.id;
    UPDATE firewall set updated_at=CURRENT_TIMESTAMP WHERE id=NEW.firewall;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `policy_r_AFTER_DELETE` AFTER DELETE ON `policy_r` FOR EACH ROW BEGIN
	UPDATE firewall set updated_at=CURRENT_TIMESTAMP WHERE id=OLD.firewall;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `policy_r__interface`
--

DROP TABLE IF EXISTS `policy_r__interface`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `policy_r__interface` (
  `rule` int(11) NOT NULL,
  `interface` int(11) NOT NULL,
  `position` int(11) NOT NULL,
  `negate` tinyint(1) NOT NULL DEFAULT '0',
  `position_order` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`rule`,`interface`,`position`),
  KEY `idx_interface` (`interface`),
  KEY `idx_position` (`position`),
  CONSTRAINT `fk_policy_r__interface-interface` FOREIGN KEY (`interface`) REFERENCES `interface` (`id`),
  CONSTRAINT `fk_policy_r__interface-policy_position` FOREIGN KEY (`position`) REFERENCES `policy_position` (`id`),
  CONSTRAINT `fk_policy_r__interface-policy_r` FOREIGN KEY (`rule`) REFERENCES `policy_r` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `policy_r__interface`
--

LOCK TABLES `policy_r__interface` WRITE;
/*!40000 ALTER TABLE `policy_r__interface` DISABLE KEYS */;
/*!40000 ALTER TABLE `policy_r__interface` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_r__interface_AFTER_INSERT` AFTER INSERT ON `policy_r__interface` FOR EACH ROW
BEGIN
	call update__rule_ts(NEW.rule);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_r__interface_AFTER_UPDATE` AFTER UPDATE ON `policy_r__interface` FOR EACH ROW
BEGIN
	call update__rule_ts(NEW.rule);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_r__interface_AFTER_DELETE` AFTER DELETE ON `policy_r__interface` FOR EACH ROW
BEGIN
	call update__rule_ts(OLD.rule);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `policy_r__ipobj`
--

DROP TABLE IF EXISTS `policy_r__ipobj`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `policy_r__ipobj` (
  `id_pi` int(11) NOT NULL AUTO_INCREMENT,
  `rule` int(11) NOT NULL,
  `ipobj` int(11) DEFAULT '0' COMMENT 'id IPOBJ',
  `ipobj_g` int(11) DEFAULT '0' COMMENT 'ID IPOBJ GROUP',
  `interface` int(11) DEFAULT '0' COMMENT 'ID Interface in this position',
  `position` int(11) NOT NULL,
  `position_order` int(11) NOT NULL,
  `negate` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id_pi`),
  UNIQUE KEY `idx_rule-ipobj-ipobj_g-interface-position` (`rule`,`ipobj`,`ipobj_g`,`interface`,`position`),
  KEY `idx_rule` (`rule`),
  KEY `idx_position` (`position`),
  CONSTRAINT `fk_policy_r__ipobj-policy_position` FOREIGN KEY (`position`) REFERENCES `policy_position` (`id`),
  CONSTRAINT `fk_policy_r__ipobj-policy_r` FOREIGN KEY (`rule`) REFERENCES `policy_r` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `policy_r__ipobj`
--

LOCK TABLES `policy_r__ipobj` WRITE;
/*!40000 ALTER TABLE `policy_r__ipobj` DISABLE KEYS */;
/*!40000 ALTER TABLE `policy_r__ipobj` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_r__ipobj_AFTER_INSERT` AFTER INSERT ON `policy_r__ipobj` FOR EACH ROW
BEGIN
	call update__rule_ts(NEW.rule);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_r__ipobj_AFTER_UPDATE` AFTER UPDATE ON `policy_r__ipobj` FOR EACH ROW
BEGIN
	call update__rule_ts(NEW.rule);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_r__ipobj_AFTER_DELETE` AFTER DELETE ON `policy_r__ipobj` FOR EACH ROW
BEGIN
	call update__rule_ts(OLD.rule);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `policy_type`
--

DROP TABLE IF EXISTS `policy_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `policy_type` (
  `id` tinyint(1) NOT NULL,
  `type` varchar(1) NOT NULL,
  `name` varchar(50) DEFAULT NULL,
  `type_order` tinyint(2) NOT NULL DEFAULT '1',
  `show_action` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `policy_type`
--

LOCK TABLES `policy_type` WRITE;
/*!40000 ALTER TABLE `policy_type` DISABLE KEYS */;
INSERT INTO `policy_type` VALUES (1,'I','Input',1,1),(2,'O','Output',2,1),(3,'F','Forward',3,1),(4,'S','SNAT',4,0),(5,'D','DNAT',5,0),(6,'R','Routing',6,1);
/*!40000 ALTER TABLE `policy_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `routing_g`
--

DROP TABLE IF EXISTS `routing_g`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `routing_g` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `firewall` int(11) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `comment` longtext COLLATE utf8_unicode_ci NOT NULL,
  `idgroup` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_firewall` (`firewall`),
  CONSTRAINT `fk_routing_g-firewall` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `routing_g`
--

LOCK TABLES `routing_g` WRITE;
/*!40000 ALTER TABLE `routing_g` DISABLE KEYS */;
/*!40000 ALTER TABLE `routing_g` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `routing_position`
--

DROP TABLE IF EXISTS `routing_position`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `routing_position` (
  `id` int(11) NOT NULL,
  `name` varchar(45) NOT NULL,
  `position_order` tinyint(2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `routing_position`
--

LOCK TABLES `routing_position` WRITE;
/*!40000 ALTER TABLE `routing_position` DISABLE KEYS */;
INSERT INTO `routing_position` VALUES (1,'Destination',NULL,'2017-02-21 12:43:27','2017-02-21 12:43:27',0,0),(2,'Gateway',NULL,'2017-02-21 12:43:27','2017-02-21 12:43:27',0,0),(3,'Interface',NULL,'2017-02-21 12:43:27','2017-02-21 12:43:27',0,0);
/*!40000 ALTER TABLE `routing_position` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `routing_r`
--

DROP TABLE IF EXISTS `routing_r`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `routing_r` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `idgroup` int(11) DEFAULT NULL,
  `firewall` int(11) DEFAULT NULL,
  `rule_order` int(11) NOT NULL DEFAULT '0',
  `metric` int(11) NOT NULL,
  `options` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `comment` longtext COLLATE utf8_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_idgroup` (`idgroup`),
  KEY `idx_firewall` (`firewall`),
  CONSTRAINT `fk_routing_r-firewall` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`),
  CONSTRAINT `fk_routing_r-routing_g` FOREIGN KEY (`idgroup`) REFERENCES `routing_g` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `routing_r`
--

LOCK TABLES `routing_r` WRITE;
/*!40000 ALTER TABLE `routing_r` DISABLE KEYS */;
/*!40000 ALTER TABLE `routing_r` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `routing_r__interface`
--

DROP TABLE IF EXISTS `routing_r__interface`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `routing_r__interface` (
  `rule` int(11) NOT NULL,
  `interface` int(11) NOT NULL,
  `interface_order` varchar(45) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`rule`,`interface`),
  KEY `idx_interface` (`interface`),
  CONSTRAINT `fk_routing_r__interface-interface` FOREIGN KEY (`interface`) REFERENCES `interface` (`id`),
  CONSTRAINT `fk_routing_r__interface-routing_r` FOREIGN KEY (`rule`) REFERENCES `routing_r` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `routing_r__interface`
--

LOCK TABLES `routing_r__interface` WRITE;
/*!40000 ALTER TABLE `routing_r__interface` DISABLE KEYS */;
/*!40000 ALTER TABLE `routing_r__interface` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `routing_r__ipobj`
--

DROP TABLE IF EXISTS `routing_r__ipobj`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `routing_r__ipobj` (
  `rule` int(11) NOT NULL,
  `ipobj` int(11) NOT NULL,
  `ipobj_g` int(11) NOT NULL,
  `position` int(11) NOT NULL,
  `position_order` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`rule`,`ipobj`,`ipobj_g`,`position`),
  KEY `idx_ipobj_g` (`ipobj_g`),
  KEY `idx_ipobj` (`ipobj`),
  CONSTRAINT `fk_routing_r__ipobj-ipobj` FOREIGN KEY (`ipobj`) REFERENCES `ipobj` (`id`),
  CONSTRAINT `fk_routing_r__ipobj-ipobj_g` FOREIGN KEY (`ipobj_g`) REFERENCES `ipobj_g` (`id`),
  CONSTRAINT `fk_routing_r__ipobj-routing_r` FOREIGN KEY (`rule`) REFERENCES `routing_r` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `routing_r__ipobj`
--

LOCK TABLES `routing_r__ipobj` WRITE;
/*!40000 ALTER TABLE `routing_r__ipobj` DISABLE KEYS */;
/*!40000 ALTER TABLE `routing_r__ipobj` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer` int(11) DEFAULT NULL,
  `username` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `password` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `last_login` datetime DEFAULT NULL,
  `locked` tinyint(1) NOT NULL DEFAULT '0',
  `expired` tinyint(1) NOT NULL DEFAULT '0',
  `expires_at` datetime DEFAULT NULL,
  `confirmation_token` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `password_requested_at` datetime DEFAULT NULL,
  `allowed_ip` varchar(255) CHARACTER SET utf8 NOT NULL DEFAULT '*',
  `role` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  `last_access` varchar(45) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer`),
  CONSTRAINT `fk_user-customer` FOREIGN KEY (`customer`) REFERENCES `customer` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES (1,1,'fwcadmin','info@soltecsis.com',1,'$2a$10$DPBdl3/ymJ9m47Wk8/ByBewWGOzNXhhBBoL7kN8N1bcEtR.rs1CGO',NULL,0,0,NULL,'xfcfpXzo7pMKfwvftsaSD7fOYYTUTvVh_3Ssia0qyXyRzUfaBJ4Mr',NULL,'','1',NULL,'2018-12-31 00:00:00','2018-12-31 00:00:00',0,0,'');
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user__cloud`
--

DROP TABLE IF EXISTS `user__cloud`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user__cloud` (
  `fwcloud` int(11) NOT NULL,
  `id_user` int(11) NOT NULL,
  `allow_access` tinyint(1) NOT NULL DEFAULT '0',
  `allow_edit` tinyint(1) NOT NULL DEFAULT '0',
  `allow_admin` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  KEY `idx_fwcloud-id_user` (`fwcloud`,`id_user`) USING BTREE,
  KEY `idx_id_user` (`id_user`),
  CONSTRAINT `fk_user__cloud-fwcloud` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`),
  CONSTRAINT `fk_user_cloud-user` FOREIGN KEY (`id_user`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user__cloud`
--

LOCK TABLES `user__cloud` WRITE;
/*!40000 ALTER TABLE `user__cloud` DISABLE KEYS */;
/*!40000 ALTER TABLE `user__cloud` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user__firewall`
--

DROP TABLE IF EXISTS `user__firewall`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user__firewall` (
  `id_firewall` int(11) NOT NULL,
  `id_user` int(11) NOT NULL,
  `allow_access` tinyint(1) NOT NULL DEFAULT '0',
  `allow_edit` tinyint(1) NOT NULL DEFAULT '0',
  `allow_admin` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  KEY `idx_id_firewall-id_user` (`id_firewall`,`id_user`) USING BTREE,
  KEY `idx_id_user` (`id_user`),
  CONSTRAINT `fk_user__firewall-firewall` FOREIGN KEY (`id_firewall`) REFERENCES `firewall` (`id`),
  CONSTRAINT `fk_user__firewall-user` FOREIGN KEY (`id_user`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user__firewall`
--

LOCK TABLES `user__firewall` WRITE;
/*!40000 ALTER TABLE `user__firewall` DISABLE KEYS */;
/*!40000 ALTER TABLE `user__firewall` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'fwcloud'
--

--
-- Dumping routines for database 'fwcloud'
--
/*!50003 DROP PROCEDURE IF EXISTS `update__rule_ts` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `update__rule_ts`(IN param_rule int(11))
BEGIN
	UPDATE policy_r set updated_at= CURRENT_TIMESTAMP WHERE id=param_rule;
    UPDATE policy_c set status_compiled=0  WHERE rule=param_rule;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2018-11-16 17:44:46
