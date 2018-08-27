-- MySQL dump 10.13  Distrib 5.7.23, for Linux (x86_64)
--
-- Host: localhost    Database: fwcloud_db
-- ------------------------------------------------------
-- Server version	5.7.23-0ubuntu0.16.04.1

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
  KEY `fk_cluster_cloud` (`fwcloud`) USING BTREE,
  CONSTRAINT `fk_cluster_cloud` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
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
  PRIMARY KEY (`id`),
  KEY `IDX_48011B7EE5C56994` (`cluster`),
  KEY `fk_firewall_1_idx` (`fwcloud`),
  CONSTRAINT `fk_cloud` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cluster` FOREIGN KEY (`cluster`) REFERENCES `cluster` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`firewall_AFTER_INSERT` AFTER INSERT ON `firewall` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at= CURRENT_TIMESTAMP  WHERE id=NEW.fwcloud;    
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`firewall_AFTER_UPDATE` AFTER UPDATE ON `firewall` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at= CURRENT_TIMESTAMP  WHERE id=NEW.fwcloud;
    
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`firewall_AFTER_DELETE` AFTER DELETE ON `firewall` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at= CURRENT_TIMESTAMP  WHERE id=OLD.fwcloud;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `firewall_cluster`
--

DROP TABLE IF EXISTS `firewall_cluster`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `firewall_cluster` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `idcluster` int(11) NOT NULL,
  `firewall` int(11) DEFAULT NULL,
  `firewall_name` varchar(45) DEFAULT NULL,
  `sshuser` varchar(250) DEFAULT NULL,
  `sshpass` varchar(250) DEFAULT NULL,
  `save_user_pass` varchar(45) NOT NULL DEFAULT '1',
  `interface` int(11) DEFAULT NULL,
  `ipobj` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_firewall_cluster_1_idx` (`idcluster`),
  KEY `fk_firewall_cluster_2_idx` (`interface`),
  KEY `fk_firewall_cluster_3_idx` (`ipobj`),
  KEY `index5` (`idcluster`,`firewall`,`firewall_name`),
  CONSTRAINT `fk_firewall_cluster_1` FOREIGN KEY (`idcluster`) REFERENCES `cluster` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_firewall_cluster_2` FOREIGN KEY (`interface`) REFERENCES `interface` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_firewall_cluster_3` FOREIGN KEY (`ipobj`) REFERENCES `ipobj` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `firewall_cluster`
--

LOCK TABLES `firewall_cluster` WRITE;
/*!40000 ALTER TABLE `firewall_cluster` DISABLE KEYS */;
/*!40000 ALTER TABLE `firewall_cluster` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fwc_tree`
--

DROP TABLE IF EXISTS `fwc_tree`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fwc_tree` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL,
  `comment` longtext,
  `id_parent` int(11) DEFAULT NULL,
  `node_level` tinyint(6) NOT NULL DEFAULT '1',
  `node_order` tinyint(2) NOT NULL DEFAULT '0',
  `node_icon` varchar(45) DEFAULT NULL,
  `node_type` char(3) DEFAULT NULL,
  `expanded` tinyint(1) NOT NULL DEFAULT '0',
  `subfolders` tinyint(1) NOT NULL DEFAULT '0',
  `api_call` varchar(255) DEFAULT NULL,
  `id_obj` int(11) DEFAULT NULL,
  `obj_type` int(11) DEFAULT NULL,
  `fwcloud` int(11) DEFAULT NULL,
  `show_action` tinyint(1) NOT NULL DEFAULT '0',
  `fwcloud_tree` tinyint(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_obj` (`id_obj`,`obj_type`,`id_parent`,`node_type`),
  KEY `idx_parent` (`id_parent`)
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
-- Table structure for table `fwc_tree_childtypes`
--

DROP TABLE IF EXISTS `fwc_tree_childtypes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fwc_tree_childtypes` (
  `id_node` int(11) NOT NULL,
  `node_type` char(2) NOT NULL,
  PRIMARY KEY (`id_node`,`node_type`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fwc_tree_childtypes`
--

LOCK TABLES `fwc_tree_childtypes` WRITE;
/*!40000 ALTER TABLE `fwc_tree_childtypes` DISABLE KEYS */;
/*!40000 ALTER TABLE `fwc_tree_childtypes` ENABLE KEYS */;
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
INSERT INTO `fwc_tree_node_types` VALUES ('CL',NULL,'Cluster',NULL,1),('FCF',NULL,'Folder Cluster Firewalls',NULL,2),('FD',NULL,'Folder',NULL,1),('FDC',NULL,'Folder Clusters',NULL,2),('FDF',NULL,'Folder Firewalls',NULL,2),('FDI',10,'Folder Interfaces',NULL,2),('FDO',NULL,'Folder Objects',NULL,1),('FDS',NULL,'Folder Services',NULL,1),('FDT',NULL,'Folder Times',NULL,1),('FP',NULL,'FILTER POLICIES',NULL,1),('FW',NULL,'Firewall',NULL,1),('IFF',10,'Interfaces Firewalls',NULL,2),('IFH',11,'Interfaces Host',NULL,2),('NT',NULL,'NAT Rules',NULL,1),('NTD',NULL,'DNAT Rules',NULL,1),('NTS',NULL,'SNAT Rules',NULL,1),('OIA',5,'IP Address Objects',NULL,2),('OIG',20,'Objects Groups',NULL,2),('OIH',8,'IP Host Objects',NULL,2),('OIN',7,'IP Network Objects',NULL,2),('OIR',6,'IP Address Range Objects',NULL,2),('PF',NULL,'Policy Forward Rules',NULL,1),('PI',NULL,'Policy IN Rules',NULL,1),('PO',NULL,'Policy OUT Rules',NULL,1),('RR',NULL,'Routing rules',NULL,1),('SOC',0,'Services Customs',NULL,2),('SOG',21,'Services Groups',NULL,2),('SOI',1,'IP Service Objects',NULL,2),('SOM',3,'ICMP Service Objects',NULL,2),('SOT',2,'TCP Service Objects',NULL,2),('SOU',4,'UDP Service Objects',NULL,2);
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
  KEY `IDX_34F4ECDD48011B7E` (`firewall`),
  CONSTRAINT `FK_34F4ECDD48011B7E` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`)
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`interface_AFTER_INSERT` AFTER INSERT ON `interface` FOR EACH ROW
BEGIN
	UPDATE firewall set updated_at= CURRENT_TIMESTAMP WHERE id=NEW.firewall;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`interface_AFTER_UPDATE` AFTER UPDATE ON `interface` FOR EACH ROW
BEGIN
	UPDATE policy_r__ipobj set updated_at= CURRENT_TIMESTAMP  WHERE interface=NEW.id ;
    UPDATE policy_r__interface set updated_at= CURRENT_TIMESTAMP  WHERE interface=NEW.id ;
    UPDATE interface__ipobj set updated_at= CURRENT_TIMESTAMP  WHERE interface=NEW.id ;
    UPDATE firewall set updated_at= CURRENT_TIMESTAMP WHERE id=NEW.firewall;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`interface_AFTER_DELETE` AFTER DELETE ON `interface` FOR EACH ROW
BEGIN
	UPDATE firewall set updated_at= CURRENT_TIMESTAMP WHERE id=OLD.firewall;
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
  KEY `fk_interface__ipobj_2_idx` (`ipobj`),
  CONSTRAINT `fk_interface__ipobj_1` FOREIGN KEY (`interface`) REFERENCES `interface` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_interface__ipobj_2` FOREIGN KEY (`ipobj`) REFERENCES `ipobj` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
  `protocol` tinyint(1) UNSIGNED DEFAULT NULL,
  `address` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `netmask` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `diff_serv` tinyint(1) UNSIGNED DEFAULT NULL,
  `ip_version` tinyint(1) UNSIGNED DEFAULT NULL,
  `icmp_type` smallint(2) DEFAULT NULL,
  `icmp_code` smallint(2) DEFAULT NULL,
  `tcp_flags_mask` tinyint(1) UNSIGNED DEFAULT NULL,
  `tcp_flags_settings` tinyint(1) UNSIGNED DEFAULT NULL,
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
  KEY `IDX_IPOBJ_TYPE` (`type`) COMMENT '	',
  KEY `fk_ipobj_1_idx` (`fwcloud`),
  KEY `fk_ipobj_2_idx` (`interface`),
  CONSTRAINT `fk_ipobj_1` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_ipobj_2` FOREIGN KEY (`interface`) REFERENCES `interface` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ipobj_3` FOREIGN KEY (`type`) REFERENCES `ipobj_type` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`ipobj_AFTER_INSERT` AFTER INSERT ON `ipobj` FOR EACH ROW
BEGIN
	
    UPDATE fwcloud set updated_at= CURRENT_TIMESTAMP  WHERE id=NEW.fwcloud;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`ipobj_AFTER_UPDATE` AFTER UPDATE ON `ipobj` FOR EACH ROW
BEGIN
	UPDATE policy_r__ipobj set updated_at= CURRENT_TIMESTAMP  WHERE ipobj=NEW.id ;
    UPDATE ipobj__ipobjg  set updated_at= CURRENT_TIMESTAMP  WHERE ipobj=NEW.id ;
    
    UPDATE fwcloud set updated_at= CURRENT_TIMESTAMP  WHERE id=NEW.fwcloud;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`ipobj_AFTER_DELETE` AFTER DELETE ON `ipobj` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at= CURRENT_TIMESTAMP  WHERE id=OLD.fwcloud;
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
  UNIQUE KEY `IDX_GROUP_IPOBJ` (`ipobj_g`,`ipobj`),
  KEY `IDX_964BE3EDA998FF0B` (`ipobj_g`),
  KEY `IDX_964BE3ED80184FC3` (`ipobj`),
  CONSTRAINT `FK_964BE3ED80184FC3` FOREIGN KEY (`ipobj`) REFERENCES `ipobj` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_964BE3EDA998FF0B` FOREIGN KEY (`ipobj_g`) REFERENCES `ipobj_g` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`ipobj__ipobjg_AFTER_INSERT` AFTER INSERT ON `ipobj__ipobjg` FOR EACH ROW
BEGIN
	UPDATE ipobj_g set updated_at= CURRENT_TIMESTAMP  WHERE id=NEW.ipobj_g ;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`ipobj__ipobjg_AFTER_UPDATE` AFTER UPDATE ON `ipobj__ipobjg` FOR EACH ROW
BEGIN
	UPDATE ipobj_g set updated_at= CURRENT_TIMESTAMP  WHERE id=NEW.ipobj_g ;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`ipobj__ipobjg_AFTER_DELETE` AFTER DELETE ON `ipobj__ipobjg` FOR EACH ROW
BEGIN
	UPDATE ipobj_g set updated_at= CURRENT_TIMESTAMP  WHERE id=OLD.ipobj_g ;
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`ipobj_g_AFTER_INSERT` AFTER INSERT ON `ipobj_g` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at= CURRENT_TIMESTAMP  WHERE id=NEW.fwcloud;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`ipobj_g_AFTER_UPDATE` AFTER UPDATE ON `ipobj_g` FOR EACH ROW
BEGIN
	UPDATE policy_r__ipobj set updated_at= CURRENT_TIMESTAMP  WHERE ipobj_g=NEW.id ;
    UPDATE fwcloud set updated_at= CURRENT_TIMESTAMP  WHERE id=NEW.fwcloud;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`ipobj_g_AFTER_DELETE` AFTER DELETE ON `ipobj_g` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at= CURRENT_TIMESTAMP  WHERE id=OLD.fwcloud;
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
  KEY `fk_ipobj_type__policy_position_2_idx` (`position`),
  CONSTRAINT `fk_ipobj_type__policy_position_1` FOREIGN KEY (`type`) REFERENCES `ipobj_type` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_ipobj_type__policy_position_2` FOREIGN KEY (`position`) REFERENCES `policy_position` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
  KEY `fk_ipobj_type__routing_position_2_idx` (`position`),
  CONSTRAINT `fk_ipobj_type__routing_position_1` FOREIGN KEY (`type`) REFERENCES `ipobj_type` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_ipobj_type__routing_position_2` FOREIGN KEY (`position`) REFERENCES `routing_position` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
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
-- Table structure for table `mac`
--

DROP TABLE IF EXISTS `mac`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mac` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `interface` int(11) DEFAULT NULL,
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `address` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `comment` longtext COLLATE utf8_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int(11) NOT NULL DEFAULT '0',
  `updated_by` int(11) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mac`
--

LOCK TABLES `mac` WRITE;
/*!40000 ALTER TABLE `mac` DISABLE KEYS */;
/*!40000 ALTER TABLE `mac` ENABLE KEYS */;
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
  CONSTRAINT `fk_policy_c_1` FOREIGN KEY (`rule`) REFERENCES `policy_r` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
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
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `policy_c_AFTER_UPDATE` AFTER UPDATE ON `policy_c` FOR EACH ROW BEGIN
  UPDATE firewall set updated_at= CURRENT_TIMESTAMP WHERE id=NEW.firewall;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
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
  KEY `IDX_C3DE16BA48011B7E` (`firewall`),
  KEY `index3` (`idgroup`),
  CONSTRAINT `FK_C3DE16BA48011B7E` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_policy_g_group` FOREIGN KEY (`idgroup`) REFERENCES `policy_g` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`policy_g_AFTER_INSERT` AFTER INSERT ON `policy_g` FOR EACH ROW
BEGIN
	UPDATE firewall set updated_at= CURRENT_TIMESTAMP WHERE id=NEW.firewall;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`policy_g_AFTER_UPDATE` AFTER UPDATE ON `policy_g` FOR EACH ROW
BEGIN
	UPDATE firewall set updated_at= CURRENT_TIMESTAMP WHERE id=NEW.firewall;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`policy_g_AFTER_DELETE` AFTER DELETE ON `policy_g` FOR EACH ROW
BEGIN
	UPDATE firewall set updated_at= CURRENT_TIMESTAMP WHERE id=OLD.firewall;
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
  KEY `index2` (`policy_type`,`position_order`),
  CONSTRAINT `fk_policy_position_1` FOREIGN KEY (`policy_type`) REFERENCES `policy_type` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
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
  `options` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
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
  KEY `IDX_AE03F2516DC044C5` (`idgroup`),
  KEY `IDX_AE03F25148011B7E` (`firewall`),
  KEY `fk_policy_r_type_idx` (`type`),
  CONSTRAINT `FK_AE03F25148011B7E` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_AE03F2516DC044C5` FOREIGN KEY (`idgroup`) REFERENCES `policy_g` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_policy_r_type` FOREIGN KEY (`type`) REFERENCES `policy_type` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
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
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `policy_r_AFTER_UPDATE` AFTER UPDATE ON `policy_r` FOR EACH ROW BEGIN
    UPDATE policy_c set status_compiled=0  WHERE rule=NEW.id;
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
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
  KEY `fk_policy_r__interface_2_idx` (`interface`),
  KEY `fk_policy_r__interface_3_idx` (`position`),
  CONSTRAINT `fk_policy_r__interface_1` FOREIGN KEY (`rule`) REFERENCES `policy_r` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_policy_r__interface_2` FOREIGN KEY (`interface`) REFERENCES `interface` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_policy_r__interface_3` FOREIGN KEY (`position`) REFERENCES `policy_position` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`policy_r__interface_AFTER_INSERT` AFTER INSERT ON `policy_r__interface` FOR EACH ROW
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`policy_r__interface_AFTER_UPDATE` AFTER UPDATE ON `policy_r__interface` FOR EACH ROW
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`policy_r__interface_AFTER_DELETE` AFTER DELETE ON `policy_r__interface` FOR EACH ROW
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
  UNIQUE KEY `fk_policy_r__ipobj_unq` (`rule`,`ipobj`,`ipobj_g`,`interface`,`position`),
  KEY `IDX_C4FF0A2B46D8ACCC` (`rule`),
  KEY `fk_policy_r__ipobj_position_idx` (`position`),
  CONSTRAINT `FK_C4FF0A2B46D8ACCC` FOREIGN KEY (`rule`) REFERENCES `policy_r` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_policy_r__ipobj_position` FOREIGN KEY (`position`) REFERENCES `policy_position` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`policy_r__ipobj_AFTER_INSERT` AFTER INSERT ON `policy_r__ipobj` FOR EACH ROW
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`policy_r__ipobj_AFTER_UPDATE` AFTER UPDATE ON `policy_r__ipobj` FOR EACH ROW
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
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `fwcloud_db`.`policy_r__ipobj_AFTER_DELETE` AFTER DELETE ON `policy_r__ipobj` FOR EACH ROW
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
  UNIQUE KEY `index2` (`type`)
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
  KEY `IDX_F3C2007848011B7E` (`firewall`),
  CONSTRAINT `FK_F3C2007848011B7E` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`)
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
  KEY `IDX_9E1FE4936DC044C5` (`idgroup`),
  KEY `IDX_9E1FE49348011B7E` (`firewall`),
  CONSTRAINT `FK_9E1FE49348011B7E` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`),
  CONSTRAINT `FK_9E1FE4936DC044C5` FOREIGN KEY (`idgroup`) REFERENCES `routing_g` (`id`)
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
  KEY `fk_routing_r__interface_2_idx` (`interface`),
  CONSTRAINT `fk_routing_r__interface_1` FOREIGN KEY (`rule`) REFERENCES `routing_r` (`id`),
  CONSTRAINT `fk_routing_r__interface_2` FOREIGN KEY (`interface`) REFERENCES `interface` (`id`)
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
  KEY `IDX_1FC9E72DA998FF0B` (`ipobj_g`),
  KEY `IDX_1FC9E72D80184FC3` (`ipobj`),
  CONSTRAINT `FK_1FC9E72D46D8ACCC` FOREIGN KEY (`rule`) REFERENCES `routing_r` (`id`),
  CONSTRAINT `FK_1FC9E72D80184FC3` FOREIGN KEY (`ipobj`) REFERENCES `ipobj` (`id`),
  CONSTRAINT `FK_1FC9E72DA998FF0B` FOREIGN KEY (`ipobj_g`) REFERENCES `ipobj_g` (`id`)
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
  KEY `IDX_8D93D6497D33FA72` (`customer`),
  CONSTRAINT `FK_8D93D6497D33FA72` FOREIGN KEY (`customer`) REFERENCES `customer` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES (1,1,'fwcadmin','info@soltecsis.com',1,'$2a$10$DPBdl3/ymJ9m47Wk8/ByBewWGOzNXhhBBoL7kN8N1bcEtR.rs1CGO',NULL,0,0,NULL,'xfcfpXzo7pMKfwvftsaSD7fOYYTUTvVh_3Ssia0qyXyRzUfaBJ4Mr',NULL,'','1',NULL,'0000-00-00 00:00:00','0000-00-00 00:00:00',0,0,'');
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
  KEY `idx_uc` (`fwcloud`,`id_user`) USING BTREE,
  KEY `fk_user_cloud_idx` (`id_user`),
  CONSTRAINT `fk_user__cloud_1` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_cloud` FOREIGN KEY (`id_user`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
  KEY `idx_uf` (`id_firewall`,`id_user`) USING BTREE,
  KEY `fk_user_idx` (`id_user`),
  CONSTRAINT `fk_firewall` FOREIGN KEY (`id_firewall`) REFERENCES `firewall` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user` FOREIGN KEY (`id_user`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
-- Dumping routines for database 'fwcloud_db'
--
/*!50003 DROP PROCEDURE IF EXISTS `update__rule_ts` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8 */ ;
/*!50003 SET character_set_results = utf8 */ ;
/*!50003 SET collation_connection  = utf8_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE PROCEDURE `update__rule_ts`(IN param_rule int(11))
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

-- Dump completed on 2018-08-06 13:55:28
