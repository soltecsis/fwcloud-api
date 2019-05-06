-- MySQL dump 10.13  Distrib 5.7.26, for Linux (x86_64)
--
-- Host: localhost    Database: fwcloud
-- ------------------------------------------------------
-- Server version	5.7.26-0ubuntu0.16.04.1

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
  `comment` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
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
-- Table structure for table `ca_prefix`
--

DROP TABLE IF EXISTS `ca_prefix`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ca_prefix` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ca` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_ca-name` (`ca`,`name`),
  KEY `idx_ca` (`ca`),
  CONSTRAINT `fk_ca_prefix-ca` FOREIGN KEY (`ca`) REFERENCES `ca` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ca_prefix`
--

LOCK TABLES `ca_prefix` WRITE;
/*!40000 ALTER TABLE `ca_prefix` DISABLE KEYS */;
/*!40000 ALTER TABLE `ca_prefix` ENABLE KEYS */;
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
  `comment` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
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
  `addr` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `phone` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `web` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
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
INSERT INTO `customer` VALUES (1,'SOLTECSIS, S.L.','C/Carrasca,7 - 03590 Altea (Alicante) - Spain','+34 966 446 046','info@soltecsis.com','https://soltecsis.com','2019-05-06 10:22:12','2019-05-06 10:22:12',1,1);
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
INSERT INTO `fwc_tree_node_types` VALUES ('CA',NULL,'CA',NULL,2),('CL',NULL,'Cluster',NULL,1),('CRT',NULL,'Certificate',NULL,2),('FCA',NULL,'Folder CA',NULL,2),('FCF',NULL,'Folder Cluster Firewalls',NULL,2),('FCR',NULL,'Folder CRT',NULL,2),('FD',NULL,'Folder',NULL,1),('FDC',NULL,'Folder Clusters',NULL,2),('FDF',NULL,'Folder Firewalls',NULL,2),('FDI',10,'Folder Interfaces',NULL,2),('FDO',NULL,'Folder Objects',NULL,1),('FDS',NULL,'Folder Services',NULL,1),('FDT',NULL,'Folder Times',NULL,1),('FP',NULL,'FILTER POLICIES',NULL,1),('FP6',NULL,'FILTER POLICIES IPv6',NULL,1),('FW',NULL,'Firewall',NULL,1),('IFF',10,'Interfaces Firewalls',NULL,2),('IFH',11,'Interfaces Host',NULL,2),('MRK',30,'IPTables marks',NULL,2),('ND6',NULL,'DNAT Rules IPv6',NULL,1),('NS6',NULL,'SNAT Rules IPv6',NULL,1),('NT',NULL,'NAT Rules',NULL,1),('NTD',NULL,'DNAT Rules',NULL,1),('NTS',NULL,'SNAT Rules',NULL,1),('OCL',311,'OpenVPN Config CLI',NULL,2),('OIA',5,'IP Address Objects',NULL,2),('OIG',20,'Objects Groups',NULL,2),('OIH',8,'IP Host Objects',NULL,2),('OIN',7,'IP Network Objects',NULL,2),('OIR',6,'IP Address Range Objects',NULL,2),('ONS',9,'DNS Names',NULL,2),('OPN',310,'OpenVPN Config',NULL,2),('OSR',312,'OpenVPN Config SRV',NULL,2),('PF',NULL,'Policy Forward Rules',NULL,1),('PF6',NULL,'Policy Forward Rules IPv6',NULL,1),('PI',NULL,'Policy IN Rules',NULL,1),('PI6',NULL,'Policy IN Rules IPv6',NULL,1),('PO',NULL,'Policy OUT Rules',NULL,1),('PO6',NULL,'Policy OUT Rules IPv6',NULL,1),('PRE',NULL,'CRT prefix folder',NULL,2),('PRO',NULL,'OpenVPN server prefix',NULL,2),('RR',NULL,'Routing rules',NULL,1),('SOC',0,'Services Customs',NULL,2),('SOG',21,'Services Groups',NULL,2),('SOI',1,'IP Service Objects',NULL,2),('SOM',3,'ICMP Service Objects',NULL,2),('SOT',2,'TCP Service Objects',NULL,2),('SOU',4,'UDP Service Objects',NULL,2),('STD',NULL,'Standard objects folder',NULL,2);
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ipobj_type`
--

LOCK TABLES `ipobj_type` WRITE;
/*!40000 ALTER TABLE `ipobj_type` DISABLE KEYS */;
INSERT INTO `ipobj_type` VALUES (0,'FIREWALL',NULL),(1,'IP',NULL),(2,'TCP',6),(3,'ICMP',1),(4,'UDP',17),(5,'ADDRESS',NULL),(6,'ADDRESS RANGE',NULL),(7,'NETWORK',NULL),(8,'HOST',NULL),(9,'DNS',NULL),(10,'INTERFACE FIREWALL',NULL),(11,'INTERFACE HOST',NULL),(20,'GROUP OBJECTS',NULL),(21,'GROUP SERVICES',NULL),(30,'IPTABLES MARKS',NULL),(100,'CLUSTER',NULL),(300,'CA',NULL),(301,'CRT_CLIENT',NULL),(302,'CRT_SERVER',NULL),(310,'OPENVPN CONFIG',NULL),(311,'OPENVPN CLI',NULL),(312,'OPENVPN SRV',NULL),(400,'CRT PREFIX FOLDER',NULL),(401,'OPENVPN SERVER PREFIX',NULL);
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
INSERT INTO `ipobj_type__policy_position` VALUES (5,1),(6,1),(7,1),(8,1),(10,1),(11,1),(20,1),(311,1),(401,1),(5,2),(6,2),(7,2),(8,2),(10,2),(11,2),(20,2),(311,2),(401,2),(1,3),(2,3),(3,3),(4,3),(21,3),(5,4),(6,4),(7,4),(8,4),(10,4),(11,4),(20,4),(311,4),(401,4),(5,5),(6,5),(7,5),(8,5),(10,5),(11,5),(20,5),(311,5),(401,5),(1,6),(2,6),(3,6),(4,6),(21,6),(5,7),(6,7),(7,7),(8,7),(10,7),(11,7),(20,7),(311,7),(401,7),(5,8),(6,8),(7,8),(8,8),(10,8),(11,8),(20,8),(311,8),(401,8),(1,9),(2,9),(3,9),(4,9),(21,9),(5,11),(6,11),(7,11),(8,11),(10,11),(11,11),(20,11),(311,11),(401,11),(5,12),(6,12),(7,12),(8,12),(10,12),(11,12),(20,12),(311,12),(401,12),(1,13),(2,13),(3,13),(4,13),(21,13),(5,14),(6,14),(311,14),(401,14),(2,16),(4,16),(10,20),(10,21),(10,22),(10,24),(10,25),(5,30),(6,30),(7,30),(8,30),(10,30),(11,30),(20,30),(311,30),(401,30),(5,31),(6,31),(7,31),(8,31),(10,31),(11,31),(20,31),(311,31),(401,31),(1,32),(2,32),(3,32),(4,32),(21,32),(5,34),(6,34),(311,34),(401,34),(2,35),(4,35),(10,36),(5,37),(6,37),(7,37),(8,37),(10,37),(11,37),(20,37),(311,37),(401,37),(5,38),(6,38),(7,38),(8,38),(10,38),(11,38),(20,38),(311,38),(401,38),(1,39),(2,39),(3,39),(4,39),(21,39),(5,40),(6,40),(7,40),(8,40),(10,40),(11,40),(20,40),(311,40),(401,40),(5,41),(6,41),(7,41),(8,41),(10,41),(11,41),(20,41),(311,41),(401,41),(1,42),(2,42),(3,42),(4,42),(21,42),(5,43),(6,43),(7,43),(8,43),(10,43),(11,43),(20,43),(311,43),(401,43),(5,44),(6,44),(7,44),(8,44),(10,44),(11,44),(20,44),(311,44),(401,44),(1,45),(2,45),(3,45),(4,45),(21,45),(5,46),(6,46),(7,46),(8,46),(10,46),(11,46),(20,46),(311,46),(401,46),(5,47),(6,47),(7,47),(8,47),(10,47),(11,47),(20,47),(311,47),(401,47),(1,48),(2,48),(3,48),(4,48),(21,48),(5,49),(6,49),(311,49),(401,49),(2,50),(4,50),(10,51),(10,52),(10,53),(10,54),(10,55),(5,56),(6,56),(7,56),(8,56),(10,56),(11,56),(20,56),(311,56),(401,56),(5,57),(6,57),(7,57),(8,57),(10,57),(11,57),(20,57),(311,57),(401,57),(1,58),(2,58),(3,58),(4,58),(21,58),(5,59),(6,59),(311,59),(401,59),(2,60),(4,60),(10,61);
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
-- Table structure for table `mark`
--

DROP TABLE IF EXISTS `mark`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mark` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` int(11) NOT NULL,
  `fwcloud` int(11) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8 NOT NULL,
  `comment` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_code_fwcloud` (`code`,`fwcloud`),
  KEY `idx_fwcloud` (`fwcloud`),
  CONSTRAINT `fk_mark-fwcloud` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mark`
--

LOCK TABLES `mark` WRITE;
/*!40000 ALTER TABLE `mark` DISABLE KEYS */;
/*!40000 ALTER TABLE `mark` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `openvpn`
--

DROP TABLE IF EXISTS `openvpn`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `openvpn` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `openvpn` int(11) DEFAULT NULL,
  `firewall` int(11) NOT NULL,
  `crt` int(11) NOT NULL,
  `install_dir` varchar(255) DEFAULT NULL,
  `install_name` varchar(255) DEFAULT NULL,
  `comment` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  `installed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_firewall-crt` (`firewall`,`crt`),
  KEY `idx_firewall` (`firewall`),
  KEY `idx_crt` (`crt`),
  KEY `idx_openvpn` (`openvpn`),
  CONSTRAINT `fk_openvpn-crt` FOREIGN KEY (`crt`) REFERENCES `crt` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_openvpn-firewall` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_openvpn-openvpn` FOREIGN KEY (`openvpn`) REFERENCES `openvpn` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `openvpn`
--

LOCK TABLES `openvpn` WRITE;
/*!40000 ALTER TABLE `openvpn` DISABLE KEYS */;
/*!40000 ALTER TABLE `openvpn` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `openvpn__ipobj_g`
--

DROP TABLE IF EXISTS `openvpn__ipobj_g`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `openvpn__ipobj_g` (
  `openvpn` int(11) NOT NULL,
  `ipobj_g` int(11) NOT NULL,
  PRIMARY KEY (`openvpn`,`ipobj_g`),
  KEY `idx_openvpn` (`openvpn`),
  KEY `idx_ipobj_g` (`ipobj_g`),
  CONSTRAINT `fk_openvpn__ipobj_g-ipobj_g` FOREIGN KEY (`ipobj_g`) REFERENCES `ipobj_g` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_openvpn__ipobj_g-openvpn` FOREIGN KEY (`openvpn`) REFERENCES `openvpn` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `openvpn__ipobj_g`
--

LOCK TABLES `openvpn__ipobj_g` WRITE;
/*!40000 ALTER TABLE `openvpn__ipobj_g` DISABLE KEYS */;
/*!40000 ALTER TABLE `openvpn__ipobj_g` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `openvpn_opt`
--

DROP TABLE IF EXISTS `openvpn_opt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `openvpn_opt` (
  `openvpn` int(11) NOT NULL,
  `ipobj` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `arg` varchar(255) DEFAULT NULL,
  `order` int(11) unsigned NOT NULL,
  `scope` tinyint(1) unsigned NOT NULL,
  `comment` varchar(255) DEFAULT NULL,
  KEY `idx_openvpn` (`openvpn`),
  KEY `idx_ipobj` (`ipobj`),
  CONSTRAINT `fk_openvpn_opt-ipobj` FOREIGN KEY (`ipobj`) REFERENCES `ipobj` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_openvpn_opt-openvpn` FOREIGN KEY (`openvpn`) REFERENCES `openvpn` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
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
-- Table structure for table `openvpn_prefix`
--

DROP TABLE IF EXISTS `openvpn_prefix`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `openvpn_prefix` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `openvpn` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_openvpn-name` (`openvpn`,`name`),
  KEY `idx_openvpn` (`openvpn`),
  CONSTRAINT `fk_openvpn_prefix-openvpn` FOREIGN KEY (`openvpn`) REFERENCES `openvpn` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `openvpn_prefix`
--

LOCK TABLES `openvpn_prefix` WRITE;
/*!40000 ALTER TABLE `openvpn_prefix` DISABLE KEYS */;
/*!40000 ALTER TABLE `openvpn_prefix` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `openvpn_prefix__ipobj_g`
--

DROP TABLE IF EXISTS `openvpn_prefix__ipobj_g`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `openvpn_prefix__ipobj_g` (
  `prefix` int(11) NOT NULL,
  `ipobj_g` int(11) NOT NULL,
  KEY `idx_prefix` (`prefix`),
  KEY `idx_ipobj_g` (`ipobj_g`),
  CONSTRAINT `fk_prefix__ipobj_g-ipobj_g` FOREIGN KEY (`ipobj_g`) REFERENCES `ipobj_g` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_prefix__ipobj_g-openvpn_prefix` FOREIGN KEY (`prefix`) REFERENCES `openvpn_prefix` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `openvpn_prefix__ipobj_g`
--

LOCK TABLES `openvpn_prefix__ipobj_g` WRITE;
/*!40000 ALTER TABLE `openvpn_prefix__ipobj_g` DISABLE KEYS */;
/*!40000 ALTER TABLE `openvpn_prefix__ipobj_g` ENABLE KEYS */;
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
  `comment` longtext COLLATE utf8_unicode_ci,
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
INSERT INTO `policy_position` VALUES (1,'Source',1,2,'O',0),(2,'Destination',1,3,'O',0),(3,'Service',1,4,'O',0),(4,'Source',2,2,'O',0),(5,'Destination',2,3,'O',0),(6,'Service',2,4,'O',0),(7,'Source',3,3,'O',0),(8,'Destination',3,4,'O',0),(9,'Service',3,5,'O',0),(11,'Source',4,2,'O',0),(12,'Destination',4,3,'O',0),(13,'Service',4,4,'O',0),(14,'Translated Source',4,5,'O',1),(16,'Translated Service',4,6,'O',1),(20,'In',1,1,'I',0),(21,'Out',2,1,'I',0),(22,'In',3,1,'I',0),(24,'Out',4,1,'I',0),(25,'Out',3,2,'I',0),(30,'Source',5,2,'O',0),(31,'Destination',5,3,'O',0),(32,'Service',5,4,'O',0),(34,'Translated Destination',5,5,'O',1),(35,'Translated Service',5,6,'O',1),(36,'In',5,1,'I',0),(37,'Source',61,2,'O',0),(38,'Destination',61,3,'O',0),(39,'Service',61,4,'O',0),(40,'Source',62,2,'O',0),(41,'Destination',62,3,'O',0),(42,'Service',62,4,'O',0),(43,'Source',63,3,'O',0),(44,'Destination',63,4,'O',0),(45,'Service',63,5,'O',0),(46,'Source',64,2,'O',0),(47,'Destination',64,3,'O',0),(48,'Service',64,4,'O',0),(49,'Translated Source',64,5,'O',1),(50,'Translated Service',64,6,'O',1),(51,'In',61,1,'I',0),(52,'Out',62,1,'I',0),(53,'In',63,1,'I',0),(54,'Out',64,1,'I',0),(55,'Out',63,2,'I',0),(56,'Source',65,2,'O',0),(57,'Destination',65,3,'O',0),(58,'Service',65,4,'O',0),(59,'Translated Destination',65,5,'O',1),(60,'Translated Service',65,6,'O',1),(61,'In',65,1,'I',0);
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
  `comment` longtext COLLATE utf8_unicode_ci,
  `options` smallint(2) NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `type` tinyint(1) DEFAULT NULL COMMENT 'rule type:  I, O, F, N',
  `style` varchar(50) CHARACTER SET utf8 DEFAULT NULL,
  `fw_apply_to` int(11) DEFAULT NULL,
  `negate` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `mark` int(11) DEFAULT NULL,
  `special` int(11) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_idgroup` (`idgroup`),
  KEY `idx_firewall` (`firewall`),
  KEY `idx_type` (`type`),
  KEY `idx_mark` (`mark`),
  CONSTRAINT `fk_policy_r-firewall` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`),
  CONSTRAINT `fk_policy_r-mark` FOREIGN KEY (`mark`) REFERENCES `mark` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
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
-- Table structure for table `policy_r__openvpn`
--

DROP TABLE IF EXISTS `policy_r__openvpn`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `policy_r__openvpn` (
  `rule` int(11) NOT NULL,
  `openvpn` int(11) NOT NULL,
  `position` int(11) NOT NULL,
  `position_order` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`rule`,`openvpn`,`position`),
  KEY `idx_openvpn` (`openvpn`),
  KEY `idx_position` (`position`),
  CONSTRAINT `fk_policy_r__openvpn-openvpn` FOREIGN KEY (`openvpn`) REFERENCES `openvpn` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_policy_r__openvpn-policy_position` FOREIGN KEY (`position`) REFERENCES `policy_position` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_policy_r__openvpn-policy_r` FOREIGN KEY (`rule`) REFERENCES `policy_r` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `policy_r__openvpn`
--

LOCK TABLES `policy_r__openvpn` WRITE;
/*!40000 ALTER TABLE `policy_r__openvpn` DISABLE KEYS */;
/*!40000 ALTER TABLE `policy_r__openvpn` ENABLE KEYS */;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_r__openvpn_AFTER_INSERT` AFTER INSERT ON `policy_r__openvpn` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_r__openvpn_AFTER_UPDATE` AFTER UPDATE ON `policy_r__openvpn` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_r__openvpn_AFTER_DELETE` AFTER DELETE ON `policy_r__openvpn` FOR EACH ROW
BEGIN
	call update__rule_ts(OLD.rule);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `policy_r__openvpn_prefix`
--

DROP TABLE IF EXISTS `policy_r__openvpn_prefix`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `policy_r__openvpn_prefix` (
  `rule` int(11) NOT NULL,
  `prefix` int(11) NOT NULL,
  `position` int(11) NOT NULL,
  `position_order` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`rule`,`prefix`,`position`),
  KEY `idx_position` (`position`),
  KEY `idx_rule` (`rule`),
  KEY `idx_prefix` (`prefix`),
  CONSTRAINT `fk_policy_r__openvpn_prefix-openvpn_prefix` FOREIGN KEY (`prefix`) REFERENCES `openvpn_prefix` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_policy_r__openvpn_prefix-policy_position` FOREIGN KEY (`position`) REFERENCES `policy_position` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_policy_r__openvpn_prefix-policy_r` FOREIGN KEY (`rule`) REFERENCES `policy_r` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `policy_r__openvpn_prefix`
--

LOCK TABLES `policy_r__openvpn_prefix` WRITE;
/*!40000 ALTER TABLE `policy_r__openvpn_prefix` DISABLE KEYS */;
/*!40000 ALTER TABLE `policy_r__openvpn_prefix` ENABLE KEYS */;
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_r__openvpn_prefix_AFTER_INSERT` AFTER INSERT ON `policy_r__openvpn_prefix` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_r__openvpn_prefix_AFTER_UPDATE` AFTER UPDATE ON `policy_r__openvpn_prefix` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud`.`policy_r__openvpn_prefix_AFTER_DELETE` AFTER DELETE ON `policy_r__openvpn_prefix` FOR EACH ROW
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
  `type` varchar(2) NOT NULL,
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
INSERT INTO `policy_type` VALUES (1,'I','Input',1,1),(2,'O','Output',2,1),(3,'F','Forward',3,1),(4,'S','SNAT',4,0),(5,'D','DNAT',5,0),(6,'R','Routing',6,1),(61,'I6','Input IPv6',1,1),(62,'O6','Output IPv6',2,1),(63,'F6','Forward IPv6',3,1),(64,'S6','SNAT IPv6',4,0),(65,'D6','DNAT IPv6',5,0);
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
  `comment` longtext COLLATE utf8_unicode_ci,
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
  `comment` longtext COLLATE utf8_unicode_ci,
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
  `name` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `username` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8 NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `role` tinyint(1) NOT NULL DEFAULT '1',
  `allowed_from` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `confirmation_token` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_customer_username` (`customer`,`username`),
  KEY `idx_customer` (`customer`),
  CONSTRAINT `fk_user-customer` FOREIGN KEY (`customer`) REFERENCES `customer` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES (1,1,'FWCloud admin user','info@soltecsis.com','fwcadmin','$2a$10$DPBdl3/ymJ9m47Wk8/ByBewWGOzNXhhBBoL7kN8N1bcEtR.rs1CGO',1,1,NULL,NULL,'','2019-05-06 10:22:14','2019-05-06 10:22:14',1,1);
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user__fwcloud`
--

DROP TABLE IF EXISTS `user__fwcloud`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user__fwcloud` (
  `user` int(11) NOT NULL,
  `fwcloud` int(11) NOT NULL,
  PRIMARY KEY (`user`,`fwcloud`),
  KEY `idx_user` (`user`),
  KEY `idx_fwcloud` (`fwcloud`),
  CONSTRAINT `fk_user__fwcloud-fwcloud` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_user__fwcloud-user` FOREIGN KEY (`user`) REFERENCES `user` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user__fwcloud`
--

LOCK TABLES `user__fwcloud` WRITE;
/*!40000 ALTER TABLE `user__fwcloud` DISABLE KEYS */;
/*!40000 ALTER TABLE `user__fwcloud` ENABLE KEYS */;
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

-- Dump completed on 2019-05-06 12:29:26
