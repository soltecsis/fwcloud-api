-- MySQL dump 10.13  Distrib 5.7.22, for Linux (x86_64)
--
-- Host: localhost    Database: fwcloud_db
-- ------------------------------------------------------
-- Server version	5.7.22-0ubuntu0.16.04.1

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
  `id_fwb` varchar(45) COLLATE utf8_unicode_ci DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '0',
  `install_user` varchar(250) COLLATE utf8_unicode_ci DEFAULT NULL,
  `install_pass` varchar(250) COLLATE utf8_unicode_ci DEFAULT NULL,
  `save_user_pass` tinyint(1) NOT NULL DEFAULT '1',
  `install_interface` int(11) DEFAULT NULL,
  `install_ipobj` int(11) DEFAULT NULL,
  `fwmaster` tinyint(1) NOT NULL DEFAULT '0',
  `install_port` int(11) NOT NULL DEFAULT '22',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_fwb_UNIQUE` (`id_fwb`),
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`firewall_AFTER_INSERT` AFTER INSERT ON `firewall` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`firewall_AFTER_UPDATE` AFTER UPDATE ON `firewall` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`firewall_AFTER_DELETE` AFTER DELETE ON `firewall` FOR EACH ROW
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
  PRIMARY KEY (`id`),
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
  `id_fwb` varchar(45) COLLATE utf8_unicode_ci DEFAULT NULL,
  `comment` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `mac` varchar(45) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_34F4ECDD48011B7E` (`firewall`),
  CONSTRAINT `FK_34F4ECDD48011B7E` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `interface`
--

LOCK TABLES `interface` WRITE;
/*!40000 ALTER TABLE `interface` DISABLE KEYS */;
INSERT INTO `interface` VALUES (1,NULL,'eth0','eth0','11',11,'2018-05-26 13:47:39','2018-05-26 13:47:39',0,0,'id3D84EED2',NULL,NULL),(2,NULL,'eth0','eth0','11',11,'2018-05-26 13:47:39','2018-05-26 13:47:39',0,0,'id3D84EEE3',NULL,NULL);
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`interface_AFTER_INSERT` AFTER INSERT ON `interface` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`interface_AFTER_UPDATE` AFTER UPDATE ON `interface` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`interface_AFTER_DELETE` AFTER DELETE ON `interface` FOR EACH ROW
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
INSERT INTO `interface__ipobj` VALUES (1,40,'1','2018-05-26 13:47:39','2018-05-26 13:47:39',0,0),(2,41,'1','2018-05-26 13:47:39','2018-05-26 13:47:39',0,0);
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
  `protocol` int(11) DEFAULT NULL,
  `address` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `netmask` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `diff_serv` tinyint(1) DEFAULT NULL,
  `ip_version` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL,
  `icmp_type` int(11) DEFAULT NULL,
  `icmp_code` int(11) DEFAULT NULL,
  `tcp_flags_mask` tinyint(1) DEFAULT NULL,
  `tcp_flags_settings` tinyint(1) DEFAULT NULL,
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
  `id_fwb` varchar(45) COLLATE utf8_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_IPOBJ_TYPE` (`type`) COMMENT '	',
  KEY `fk_ipobj_1_idx` (`fwcloud`),
  KEY `fk_ipobj_2_idx` (`interface`),
  KEY `id_fwb_UNIQUE` (`id_fwb`,`fwcloud`),
  CONSTRAINT `fk_ipobj_1` FOREIGN KEY (`fwcloud`) REFERENCES `fwcloud` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_ipobj_2` FOREIGN KEY (`interface`) REFERENCES `interface` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ipobj_3` FOREIGN KEY (`type`) REFERENCES `ipobj_type` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=191 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ipobj`
--

LOCK TABLES `ipobj` WRITE;
/*!40000 ALTER TABLE `ipobj` DISABLE KEYS */;
INSERT INTO `ipobj` VALUES (1,NULL,NULL,'Any',5,NULL,'0.0.0.0','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Any Network','2018-05-26 13:47:30','2018-05-26 13:47:30',0,0,'sysid0'),(2,NULL,NULL,'Any',1,0,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Any IP Service','2018-05-26 13:47:30','2018-05-26 13:47:30',0,0,'sysid1'),(3,NULL,NULL,'all-hosts',5,NULL,'224.0.0.1','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:30','2018-05-26 13:47:30',0,0,'id2001X88798'),(4,NULL,NULL,'all-routers',5,NULL,'224.0.0.2','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id2002X88798'),(5,NULL,NULL,'all DVMRP',5,NULL,'224.0.0.4','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id2003X88798'),(6,NULL,NULL,'OSPF (all routers)',5,NULL,'224.0.0.5','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC2328','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id2117X88798'),(7,NULL,NULL,'OSPF (designated routers)',5,NULL,'224.0.0.6','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC2328','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id2128X88798'),(8,NULL,NULL,'RIP',5,NULL,'224.0.0.9','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC1723','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id2430X88798'),(9,NULL,NULL,'EIGRP',5,NULL,'224.0.0.10','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id2439X88798'),(10,NULL,NULL,'DHCP server, relay agent',5,NULL,'224.0.0.12','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC 1884','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id2446X88798'),(11,NULL,NULL,'PIM',5,NULL,'224.0.0.13','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id2455X88798'),(12,NULL,NULL,'RSVP',5,NULL,'224.0.0.14','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id2462X88798'),(13,NULL,NULL,'VRRP',5,NULL,'224.0.0.18','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC3768','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id2469X88798'),(14,NULL,NULL,'IGMP',5,NULL,'224.0.0.22','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id2777X88798'),(15,NULL,NULL,'OSPFIGP-TE',5,NULL,'224.0.0.24','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC4973','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id2784X88798'),(16,NULL,NULL,'HSRP',5,NULL,'224.0.0.102','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id3094X88798'),(17,NULL,NULL,'mDNS',5,NULL,'224.0.0.251','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id3403X88798'),(18,NULL,NULL,'LLMNR',5,NULL,'224.0.0.252','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Link-Local Multicast Name Resolution, RFC4795','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id3410X88798'),(19,NULL,NULL,'Teredo',5,NULL,'224.0.0.253','0.0.0.0',NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id3411X88798'),(20,NULL,NULL,'broadcast',6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'255.255.255.255','255.255.255.255',0,0,0,0,NULL,'','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id3F6D115C'),(21,NULL,NULL,'old-broadcast',6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0.0.0.0','0.0.0.0',0,0,0,0,NULL,'','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id3F6D115D'),(22,NULL,NULL,'all multicasts',7,NULL,'224.0.0.0','240.0.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'224.0.0.0/4 - This block, formerly known as the Class D address\nspace, is allocated for use in IPv4 multicast address assignments.\nThe IANA guidelines for assignments from this space are described in\n[RFC3171].\n','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id3DC75CEC'),(23,NULL,NULL,'link-local',7,NULL,'169.254.0.0','255.255.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'169.254.0.0/16 - This is the \"link local\" block.  It is allocated for\ncommunication between hosts on a single link.  Hosts obtain these\naddresses by auto-configuration, such as when a DHCP server may not\nbe found.\n','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id3F4ECE3E'),(24,NULL,NULL,'loopback-net',7,NULL,'127.0.0.0','255.0.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'127.0.0.0/8 - This block is assigned for use as the Internet host\nloopback address.  A datagram sent by a higher level protocol to an\naddress anywhere within this block should loop back inside the host.\nThis is ordinarily implemented using only 127.0.0.1/32 for loopback,\nbut no addresses within this block should ever appear on any network\nanywhere [RFC1700, page 5].\n','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id3F4ECE3D'),(25,NULL,NULL,'net-10.0.0.0',7,NULL,'10.0.0.0','255.0.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'10.0.0.0/8 - This block is set aside for use in private networks.\nIts intended use is documented in [RFC1918].  Addresses within this\nblock should not appear on the public Internet.','2018-05-26 13:47:31','2018-05-26 13:47:31',0,0,'id3DC75CE5'),(26,NULL,NULL,'net-172.16.0.0',7,NULL,'172.16.0.0','255.240.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'172.16.0.0/12 - This block is set aside for use in private networks.\nIts intended use is documented in [RFC1918].  Addresses within this\nblock should not appear on the public Internet.\n','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3DC75CE7'),(27,NULL,NULL,'net-192.168.0.0',7,NULL,'192.168.0.0','255.255.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'192.168.0.0/16 - This block is set aside for use in private networks.\nIts intended use is documented in [RFC1918].  Addresses within this\nblock should not appear on the public Internet.\n','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3DC75CE6'),(28,NULL,NULL,'this-net',7,NULL,'0.0.0.0','255.0.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'0.0.0.0/8 - Addresses in this block refer to source hosts on \"this\"\nnetwork.  Address 0.0.0.0/32 may be used as a source address for this\nhost on this network; other addresses within 0.0.0.0/8 may be used to\nrefer to specified hosts on this network [RFC1700, page 4].','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3F4ECE40'),(29,NULL,NULL,'net-192.168.1.0',7,NULL,'192.168.1.0','255.255.255.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'192.168.1.0/24 - Address often used for home and small office networks.\n','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3DC75CE7-1'),(30,NULL,NULL,'net-192.168.2.0',7,NULL,'192.168.2.0','255.255.255.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'192.168.2.0/24 - Address often used for home and small office networks.\n','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3DC75CE7-2'),(31,NULL,NULL,'Benchmark tests network',7,NULL,'198.18.0.0','255.254.0.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC 5735','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3311X12564'),(32,NULL,NULL,'documentation net',7,NULL,'2001:db8::','32',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC3849','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id2088X75851'),(33,NULL,NULL,'link-local ipv6',7,NULL,'fe80::','10',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC4291   Link-local unicast net','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id2383X75851'),(34,NULL,NULL,'multicast ipv6',7,NULL,'ff00::','8',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC4291  ipv6 multicast addresses','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id2685X75851'),(35,NULL,NULL,'experimental ipv6',7,NULL,'2001::','23',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'RFC2928, RFC4773 \n\n\"The block of Sub-TLA IDs assigned to the IANA\n(i.e., 2001:0000::/29 - 2001:01F8::/29) is for\nassignment for testing and experimental usage to\nsupport activities such as the 6bone, and\nfor new approaches like exchanges.\"  [RFC2928]\n\n','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id2986X75851'),(36,NULL,NULL,'mapped-ipv4',7,NULL,'::ffff:0.0.0.0','96',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3326X12564'),(37,NULL,NULL,'translated-ipv4',7,NULL,'::ffff:0:0:0','96',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3341X12564'),(38,NULL,NULL,'Teredo',7,NULL,'2001::','32',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3350X12564'),(39,NULL,NULL,'unique-local',7,NULL,'fc00::','7',NULL,'IPv6',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3359X12564'),(40,NULL,NULL,'internal server',8,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'This host is used in examples and template objects','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3D84EECE'),(41,NULL,NULL,'server on dmz',8,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'This host is used in examples and template objects','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3D84EECF'),(42,NULL,NULL,'AH',1,51,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IPSEC Authentication Header Protocol','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3CB12797'),(43,NULL,NULL,'ESP',1,50,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IPSEC Encapsulating Security Payload Protocol','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'ip-IPSEC'),(44,NULL,NULL,'RR',1,0,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Route recording packets','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'ip-RR'),(45,NULL,NULL,'SRR',1,0,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'All sorts of Source Routing Packets','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'ip-SRR'),(46,NULL,NULL,'ip_fragments',1,0,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'\'Short\' fragments','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'ip-IP_Fragments'),(47,NULL,NULL,'SKIP',1,57,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'IPSEC Simple Key Management for Internet Protocols','2018-05-26 13:47:32','2018-05-26 13:47:32',0,0,'id3D703C8E'),(48,NULL,NULL,'GRE',1,47,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Generic Routing Encapsulation\n','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3D703C8F'),(49,NULL,NULL,'vrrp',1,112,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Virtual Router Redundancy Protocol','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3D703C95'),(50,NULL,NULL,'IGMP',1,2,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Internet Group Management Protocol, Version 3, RFC 3376','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'ip-IGMP'),(51,NULL,NULL,'PIM',1,103,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Protocol Independent Multicast - Dense Mode (PIM-DM), RFC 3973, or Protocol Independent Multicast-Sparse Mode (PIM-SM) RFC 2362','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'ip-PIM'),(52,NULL,NULL,'ALL TCP Masqueraded',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,61000,65095,0,0,NULL,'ipchains used to use this range of port numbers for masquerading. ','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'tcp-ALL_TCP_Masqueraded'),(53,NULL,NULL,'AOL',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5190,5190,NULL,'','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3D703C94'),(54,NULL,NULL,'All TCP',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'tcp-All_TCP'),(55,NULL,NULL,'Citrix-ICA',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1494,1494,NULL,'','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3CB131C4'),(56,NULL,NULL,'Entrust-Admin',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,709,709,NULL,'Entrust CA Administration Service','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3D703C91'),(57,NULL,NULL,'Entrust-KeyMgmt',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,710,710,NULL,'Entrust CA Key Management Service','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3D703C92'),(58,NULL,NULL,'H323',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1720,1720,NULL,'','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3AEDBEAC'),(59,NULL,NULL,'icslap',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2869,2869,NULL,'Sometimes this protocol is called icslap, but Microsoft does not call it that and just says that DSPP uses port 2869 in Windows XP SP2','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id412Z18A9'),(60,NULL,NULL,'LDAP GC',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3268,3268,NULL,'','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3E7E4039'),(61,NULL,NULL,'LDAP GC SSL',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3269,3269,NULL,'','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3E7E403A'),(62,NULL,NULL,'OpenWindows',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2000,2000,NULL,'Open Windows','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3D703C83'),(63,NULL,NULL,'PCAnywhere-data',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5631,5631,NULL,'data channel for PCAnywhere v7.52 and later ','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3CB131C8'),(64,NULL,NULL,'Real-Audio',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,7070,7070,NULL,'RealNetworks PNA Protocol','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3D703C8B'),(65,NULL,NULL,'RealSecure',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2998,2998,NULL,'','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3D703C93'),(66,NULL,NULL,'SMB',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,445,445,NULL,'SMB over TCP (without NETBIOS)\n','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3DC8C8BC'),(67,NULL,NULL,'TACACSplus',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,49,49,NULL,'','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3D703C8D'),(68,NULL,NULL,'TCP high ports',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1024,65535,NULL,'TCP high ports','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3D703C84'),(69,NULL,NULL,'WINS replication',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,42,42,NULL,'','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3E7E3D58'),(70,NULL,NULL,'X11',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,6000,6063,NULL,'X Window System','2018-05-26 13:47:33','2018-05-26 13:47:33',0,0,'id3D703C82'),(71,NULL,NULL,'auth',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,113,113,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'tcp-Auth'),(72,NULL,NULL,'daytime',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,13,13,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3AEDBE6E'),(73,NULL,NULL,'domain',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,53,53,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'tcp-DNS'),(74,NULL,NULL,'eklogin',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2105,2105,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3B4FEDA3'),(75,NULL,NULL,'finger',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,79,79,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3AECF774'),(76,NULL,NULL,'ftp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,21,21,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'tcp-FTP'),(77,NULL,NULL,'ftp data',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,20,20,1024,65535,NULL,'FTP data channel.\n  Note: FTP protocol does not really require server to use source port 20 for the data channel, \n  but many ftp server implementations do so.','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'tcp-FTP_data'),(78,NULL,NULL,'ftp data passive',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,20,20,NULL,'FTP data channel for passive mode transfers\n','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3E7553BC'),(79,NULL,NULL,'http',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,80,80,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'tcp-HTTP'),(80,NULL,NULL,'https',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,443,443,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3B4FED69'),(81,NULL,NULL,'imap',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,143,143,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3AECF776'),(82,NULL,NULL,'imaps',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,993,993,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3B4FED9F'),(83,NULL,NULL,'irc',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,6667,6667,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3B4FF13C'),(84,NULL,NULL,'kerberos',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,88,88,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3E7E3EA2'),(85,NULL,NULL,'klogin',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,543,543,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3B4FEE21'),(86,NULL,NULL,'ksh',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,544,544,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3B4FEE23'),(87,NULL,NULL,'ldap',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,389,389,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3AECF778'),(88,NULL,NULL,'ldaps',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,636,636,NULL,'Lightweight Directory Access Protocol over TLS/SSL','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3D703C90'),(89,NULL,NULL,'linuxconf',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,98,98,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3B4FF000'),(90,NULL,NULL,'lpr',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,515,515,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3D703C97'),(91,NULL,NULL,'microsoft-rpc',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,135,135,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3DC8C8BB'),(92,NULL,NULL,'ms-sql',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1433,1433,NULL,'Microsoft SQL Server','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3D703C98'),(93,NULL,NULL,'mysql',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3306,3306,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3B4FEEEE'),(94,NULL,NULL,'netbios-ssn',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,139,139,NULL,'','2018-05-26 13:47:34','2018-05-26 13:47:34',0,0,'id3E755609'),(95,NULL,NULL,'nfs',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2049,2049,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3B4FEE7A'),(96,NULL,NULL,'nntp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,119,119,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'tcp-NNTP'),(97,NULL,NULL,'nntps',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,563,563,NULL,'NNTP over SSL','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3E7553BB'),(98,NULL,NULL,'pop3',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,110,110,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3B4FEE1D'),(99,NULL,NULL,'pop3s',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,995,995,NULL,'POP-3 over SSL','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3E7553BA'),(100,NULL,NULL,'postgres',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5432,5432,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3B4FF0EA'),(101,NULL,NULL,'printer',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,515,515,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3AECF782'),(102,NULL,NULL,'quake',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,26000,26000,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3B4FEF7C'),(103,NULL,NULL,'rexec',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,512,512,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3AECF77A'),(104,NULL,NULL,'rlogin',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,513,513,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3AECF77C'),(105,NULL,NULL,'rshell',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,514,514,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3AECF77E'),(106,NULL,NULL,'rtsp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,554,554,NULL,'Real Time Streaming Protocol','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3D703C99'),(107,NULL,NULL,'rwhois',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,4321,4321,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3B4FEF34'),(108,NULL,NULL,'securidprop',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5510,5510,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3D703C89'),(109,NULL,NULL,'smtp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,25,25,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'tcp-SMTP'),(110,NULL,NULL,'smtps',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,465,465,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3B4FF04C'),(111,NULL,NULL,'socks',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1080,1080,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3B4FEE76'),(112,NULL,NULL,'sqlnet1',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1521,1521,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3D703C87'),(113,NULL,NULL,'squid',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3128,3128,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3B4FF09A'),(114,NULL,NULL,'ssh',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,22,22,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'tcp-SSH'),(115,NULL,NULL,'sunrpc',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,111,111,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'id3AEDBE00'),(116,NULL,NULL,'tcp-syn',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'tcp-TCP-SYN'),(117,NULL,NULL,'telnet',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,23,23,NULL,'','2018-05-26 13:47:35','2018-05-26 13:47:35',0,0,'tcp-Telnet'),(118,NULL,NULL,'uucp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,540,540,NULL,'','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'tcp-uucp'),(119,NULL,NULL,'winterm',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3389,3389,NULL,'Windows Terminal Services','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id3CB131C6'),(120,NULL,NULL,'xfs',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,7100,7100,NULL,'','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id3B4FF1B8'),(121,NULL,NULL,'xmas scan - full',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'This service object matches TCP packet with all six flags set.','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id3C685B2B'),(122,NULL,NULL,'xmas scan',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'This service object matches TCP packet with flags FIN, PSH and URG set and other flags cleared. This is a  \"christmas scan\" as defined in snort rules. Nmap can generate this scan, too.','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id4127E949'),(123,NULL,NULL,'rsync',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,873,873,NULL,'','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id4127EA72'),(124,NULL,NULL,'distcc',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,3632,3632,NULL,'distributed compiler','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id4127EBAC'),(125,NULL,NULL,'cvspserver',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2401,2401,NULL,'CVS client/server operations','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id4127ECF1'),(126,NULL,NULL,'cvsup',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5999,5999,NULL,'CVSup file transfer/John Polstra/FreeBSD','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id4127ECF2'),(127,NULL,NULL,'afp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,548,548,NULL,'AFP (Apple file sharing) over TCP','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id4127ED5E'),(128,NULL,NULL,'whois',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,43,43,NULL,'','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id4127EDF6'),(129,NULL,NULL,'bgp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,179,179,NULL,'','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id4127F04F'),(130,NULL,NULL,'radius',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1812,1812,NULL,'Radius protocol','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id4127F146'),(131,NULL,NULL,'radius acct',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1813,1813,NULL,'Radius Accounting','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id4127F147'),(132,NULL,NULL,'upnp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5000,5000,NULL,'','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id41291784'),(133,NULL,NULL,'upnp-5431',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5431,5431,NULL,'Although UPnP specification say it should use TCP port 5000, Linksys running Sveasoft firmware listens on port 5431','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id41291785'),(134,NULL,NULL,'vnc-java-0',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5800,5800,NULL,'Java VNC viewer, display 0','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id41291787'),(135,NULL,NULL,'vnc-0',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5900,5900,NULL,'Regular VNC viewer, display 0','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id41291788'),(136,NULL,NULL,'vnc-java-1',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5801,5801,NULL,'Java VNC viewer, display 1','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id41291887'),(137,NULL,NULL,'vnc-1',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5901,5901,NULL,'Regular VNC viewer, display 1','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id41291888'),(138,NULL,NULL,'All TCP established',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'Some firewall platforms can match TCP packets with flags ACK or RST set; the option is usually called \"established\".\n\nNote that you can use this object only in the policy rules of the firewall that supports this option.\n\nIf you need to match reply packets for a specific TCP service and wish to use option \"established\", make a copy of this object and set source port range to match the service.\n','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id463FE5FE11008'),(139,NULL,NULL,'rtmp',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1935,1935,NULL,'Real Time Messaging Protocol','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id1577X28030'),(140,NULL,NULL,'xmpp-client',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5222,5222,NULL,'Extensible Messaging and Presence Protocol (XMPP)   RFC3920\n','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id1590X28030'),(141,NULL,NULL,'xmpp-server',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5269,5269,NULL,'Extensible Messaging and Presence Protocol (XMPP)   RFC3920\n','2018-05-26 13:47:36','2018-05-26 13:47:36',0,0,'id1609X28030'),(142,NULL,NULL,'xmpp-client-ssl',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5223,5223,NULL,'Extensible Messaging and Presence Protocol (XMPP)   RFC3920\n','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id1622X28030'),(143,NULL,NULL,'xmpp-server-ssl',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5270,5270,NULL,'Extensible Messaging and Presence Protocol (XMPP)   RFC3920\n','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id1631X28030'),(144,NULL,NULL,'nrpe',2,6,NULL,NULL,2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5666,5666,NULL,'NRPE add-on for Nagios  http://www.nagios.org/\n','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id1644X28030'),(145,NULL,NULL,'ALL UDP Masqueraded',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,61000,65095,0,0,NULL,'ipchains used to use this port range for masqueraded packets','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'udp-ALL_UDP_Masqueraded'),(146,NULL,NULL,'All UDP',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'udp-All_UDP'),(147,NULL,NULL,'ICQ',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,4000,4000,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3D703C96'),(148,NULL,NULL,'IKE',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,500,500,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3CB129D2'),(149,NULL,NULL,'PCAnywhere-status',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,5632,5632,NULL,'status channel for PCAnywhere v7.52 and later','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3CB131CA'),(150,NULL,NULL,'RIP',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,520,520,NULL,'routing protocol RIP','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3AED0D6B'),(151,NULL,NULL,'Radius',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1645,1645,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3D703C8C'),(152,NULL,NULL,'UDP high ports',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1024,65535,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3D703C85'),(153,NULL,NULL,'Who',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,513,513,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3D703C86'),(154,NULL,NULL,'afs',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,7000,7009,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3B4FEDA1'),(155,NULL,NULL,'bootpc',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,68,68,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'udp-bootpc'),(156,NULL,NULL,'bootps',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,67,67,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'udp-bootps'),(157,NULL,NULL,'daytime',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,13,13,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3AEDBE70'),(158,NULL,NULL,'domain',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,53,53,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'udp-DNS'),(159,NULL,NULL,'interphone',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,22555,22555,NULL,'VocalTec Internet Phone','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3D703C8A'),(160,NULL,NULL,'kerberos',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,88,88,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3B4FEDA5'),(161,NULL,NULL,'kerberos-adm',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,749,750,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3B4FEDA9'),(162,NULL,NULL,'kpasswd',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,464,464,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3B4FEDA7'),(163,NULL,NULL,'krb524',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,4444,4444,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3B4FEDAB'),(164,NULL,NULL,'microsoft-rpc',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,135,135,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'id3F865B0D'),(165,NULL,NULL,'netbios-dgm',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,138,138,NULL,'','2018-05-26 13:47:37','2018-05-26 13:47:37',0,0,'udp-netbios-dgm'),(166,NULL,NULL,'netbios-ns',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,137,137,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'udp-netbios-ns'),(167,NULL,NULL,'netbios-ssn',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,139,139,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'udp-netbios-ssn'),(168,NULL,NULL,'nfs',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,2049,2049,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'id3B4FEE78'),(169,NULL,NULL,'ntp',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,123,123,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'udp-ntp'),(170,NULL,NULL,'quake',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,26000,26000,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'id3B4FEF7E'),(171,NULL,NULL,'secureid-udp',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1024,1024,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'id3D703C88'),(172,NULL,NULL,'snmp',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,161,161,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'udp-SNMP'),(173,NULL,NULL,'snmp-trap',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,162,162,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'id3AED0D69'),(174,NULL,NULL,'sunrpc',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,111,111,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'id3AEDBE19'),(175,NULL,NULL,'syslog',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,514,514,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'id3AECF780'),(176,NULL,NULL,'tftp',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,69,69,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'id3AED0D67'),(177,NULL,NULL,'traceroute',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,33434,33524,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'id3AED0D8C'),(178,NULL,NULL,'rsync',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,873,873,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'id4127EA73'),(179,NULL,NULL,'SSDP',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1900,1900,NULL,'Simple Service Discovery Protocol (used for UPnP)','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'id41291783'),(180,NULL,NULL,'OpenVPN',4,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,1194,1194,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'id41291883'),(181,NULL,NULL,'all ICMP unreachables',3,1,NULL,NULL,NULL,NULL,3,-1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'icmp-Unreachables'),(182,NULL,NULL,'any ICMP',3,1,NULL,NULL,NULL,NULL,-1,-1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'id3C20EEB5'),(183,NULL,NULL,'host_unreach',3,1,NULL,NULL,NULL,NULL,3,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'icmp-Host_unreach'),(184,NULL,NULL,'ping reply',3,1,NULL,NULL,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'icmp-ping_reply'),(185,NULL,NULL,'ping request',3,1,NULL,NULL,NULL,NULL,8,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'icmp-ping_request'),(186,NULL,NULL,'port unreach',3,1,NULL,NULL,NULL,NULL,3,3,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Port unreachable','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'icmp-Port_unreach'),(187,NULL,NULL,'time exceeded',3,1,NULL,NULL,NULL,NULL,11,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'ICMP messages of this type are needed for traceroute','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'icmp-Time_exceeded'),(188,NULL,NULL,'time exceeded in transit',3,1,NULL,NULL,NULL,NULL,11,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'','2018-05-26 13:47:38','2018-05-26 13:47:38',0,0,'icmp-Time_exceeded_in_transit'),(189,NULL,1,'ip',5,NULL,'192.168.1.10','255.255.255.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:39','2018-05-26 13:47:39',0,0,'id3D84EED3'),(190,NULL,2,'ip',5,NULL,'192.168.2.10','255.255.255.0',NULL,'IPv4',NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'','2018-05-26 13:47:39','2018-05-26 13:47:39',0,0,'id3D84EEE4');
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`ipobj_AFTER_INSERT` AFTER INSERT ON `ipobj` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`ipobj_AFTER_UPDATE` AFTER UPDATE ON `ipobj` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`ipobj_AFTER_DELETE` AFTER DELETE ON `ipobj` FOR EACH ROW
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ipobj__ipobjg`
--

LOCK TABLES `ipobj__ipobjg` WRITE;
/*!40000 ALTER TABLE `ipobj__ipobjg` DISABLE KEYS */;
INSERT INTO `ipobj__ipobjg` VALUES (1,1,25,'2018-05-26 13:47:39','2018-05-26 13:47:39',0,0),(2,1,27,'2018-05-26 13:47:39','2018-05-26 13:47:39',0,0),(3,1,26,'2018-05-26 13:47:39','2018-05-26 13:47:39',0,0),(4,2,32,'2018-05-26 13:47:39','2018-05-26 13:47:39',0,0),(5,2,35,'2018-05-26 13:47:39','2018-05-26 13:47:39',0,0),(6,2,33,'2018-05-26 13:47:39','2018-05-26 13:47:39',0,0);
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`ipobj__ipobjg_AFTER_INSERT` AFTER INSERT ON `ipobj__ipobjg` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`ipobj__ipobjg_AFTER_UPDATE` AFTER UPDATE ON `ipobj__ipobjg` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`ipobj__ipobjg_AFTER_DELETE` AFTER DELETE ON `ipobj__ipobjg` FOR EACH ROW
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
  `id_fwb` varchar(45) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  `comment` longtext COLLATE utf8_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_fwb_UNIQUE` (`id_fwb`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ipobj_g`
--

LOCK TABLES `ipobj_g` WRITE;
/*!40000 ALTER TABLE `ipobj_g` DISABLE KEYS */;
INSERT INTO `ipobj_g` VALUES (1,'rfc1918-nets',20,NULL,'2018-05-26 13:47:32','2018-05-26 13:47:39',0,0,'id3DC75CE8',NULL),(2,'ipv6 private',20,NULL,'2018-05-26 13:47:32','2018-05-26 13:47:39',0,0,'id3292X75851',NULL);
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`ipobj_g_AFTER_INSERT` AFTER INSERT ON `ipobj_g` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`ipobj_g_AFTER_UPDATE` AFTER UPDATE ON `ipobj_g` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`ipobj_g_AFTER_DELETE` AFTER DELETE ON `ipobj_g` FOR EACH ROW
BEGIN
	UPDATE fwcloud set updated_at= CURRENT_TIMESTAMP  WHERE id=OLD.fwcloud;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `ipobj_protocols`
--

DROP TABLE IF EXISTS `ipobj_protocols`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ipobj_protocols` (
  `id` int(11) NOT NULL,
  `keyword` varchar(45) DEFAULT NULL,
  `description` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ipobj_protocols`
--

LOCK TABLES `ipobj_protocols` WRITE;
/*!40000 ALTER TABLE `ipobj_protocols` DISABLE KEYS */;
INSERT INTO `ipobj_protocols` VALUES (0,'HOPOPT','IPv6 Extension Header'),(1,'ICMP','Internet Control Message'),(2,'IGMP','Internet Group Management'),(3,'GGP','Gateway-to-Gateway'),(4,'IPv4','IPv4 encapsulation'),(5,'ST','Stream'),(6,'TCP','Transmission Control'),(7,'CBT','CBT'),(8,'EGP','Exterior Gateway Protocol'),(9,'IGP','any private interior gateway (used by Cisco for their IGRP)'),(10,'BBN-RCC-MON','BBN RCC Monitoring'),(11,'NVP-II','Network Voice Protocol'),(12,'PUP','PUP'),(13,'ARGUS (deprecated)','ARGUS'),(14,'EMCON','EMCON'),(15,'XNET','Cross Net Debugger'),(16,'CHAOS','Chaos'),(17,'UDP','User Datagram'),(18,'MUX','Multiplexing'),(19,'DCN-MEAS','DCN Measurement Subsystems'),(20,'HMP','Host Monitoring'),(21,'PRM','Packet Radio Measurement'),(22,'XNS-IDP','XEROX NS IDP'),(23,'TRUNK-1','Trunk-1'),(24,'TRUNK-2','Trunk-2'),(25,'LEAF-1','Leaf-1'),(26,'LEAF-2','Leaf-2'),(27,'RDP','Reliable Data Protocol'),(28,'IRTP','Internet Reliable Transaction'),(29,'ISO-TP4','ISO Transport Protocol Class 4'),(30,'NETBLT','Bulk Data Transfer Protocol'),(31,'MFE-NSP','MFE Network Services Protocol'),(32,'MERIT-INP','MERIT Internodal Protocol'),(33,'DCCP','Datagram Congestion Control Protocol'),(34,'3PC','Third Party Connect Protocol'),(35,'IDPR','Inter-Domain Policy Routing Protocol'),(36,'XTP','XTP'),(37,'DDP','Datagram Delivery Protocol'),(38,'IDPR-CMTP','IDPR Control Message Transport Proto'),(39,'TP++','TP++ Transport Protocol'),(40,'IL','IL Transport Protocol'),(41,'IPv6','IPv6 encapsulation'),(42,'SDRP','Source Demand Routing Protocol'),(43,'IPv6-Route','Routing Header for IPv6'),(44,'IPv6-Frag','Fragment Header for IPv6'),(45,'IDRP','Inter-Domain Routing Protocol'),(46,'RSVP','Reservation Protocol'),(47,'GRE','Generic Routing Encapsulation'),(48,'DSR','Dynamic Source Routing Protocol'),(49,'BNA','BNA'),(50,'ESP','Encap Security Payload'),(51,'AH','Authentication Header'),(52,'I-NLSP','Integrated Net Layer Security  TUBA'),(53,'SWIPE (deprecated)','IP with Encryption'),(54,'NARP','NBMA Address Resolution Protocol'),(55,'MOBILE','IP Mobility'),(56,'TLSP','Transport Layer Security Protocol using Kryptonet key management'),(57,'SKIP','SKIP'),(58,'IPv6-ICMP','ICMP for IPv6'),(59,'IPv6-NoNxt','No Next Header for IPv6'),(60,'IPv6-Opts','Destination Options for IPv6'),(61,'any host internal protocol','any host internal protocol'),(62,'CFTP','CFTP'),(63,'any local network','any local network'),(64,'SAT-EXPAK','SATNET and Backroom EXPAK'),(65,'KRYPTOLAN','Kryptolan'),(66,'RVD','MIT Remote Virtual Disk Protocol'),(67,'IPPC','Internet Pluribus Packet Core'),(68,'any distributed file system','any distributed file system'),(69,'SAT-MON','SATNET Monitoring'),(70,'VISA','VISA Protocol'),(71,'IPCV','Internet Packet Core Utility'),(72,'CPNX','Computer Protocol Network Executive'),(73,'CPHB','Computer Protocol Heart Beat'),(74,'WSN','Wang Span Network'),(75,'PVP','Packet Video Protocol'),(76,'BR-SAT-MON','Backroom SATNET Monitoring'),(77,'SUN-ND','SUN ND PROTOCOL-Temporary'),(78,'WB-MON','WIDEBAND Monitoring'),(79,'WB-EXPAK','WIDEBAND EXPAK'),(80,'ISO-IP','ISO Internet Protocol'),(81,'VMTP','VMTP'),(82,'SECURE-VMTP','SECURE-VMTP'),(83,'VINES','VINES'),(84,'TTP','Transaction Transport Protocol'),(85,'NSFNET-IGP','NSFNET-IGP'),(86,'DGP','Dissimilar Gateway Protocol'),(87,'TCF','TCF'),(88,'EIGRP','EIGRP'),(89,'OSPFIGP','OSPFIGP'),(90,'Sprite-RPC','Sprite RPC Protocol'),(91,'LARP','Locus Address Resolution Protocol'),(92,'MTP','Multicast Transport Protocol'),(93,'AX.25','AX.25 Frames'),(94,'IPIP','IP-within-IP Encapsulation Protocol'),(95,'MICP (deprecated)','Mobile Internetworking Control Pro.'),(96,'SCC-SP','Semaphore Communications Sec. Pro.'),(97,'ETHERIP','Ethernet-within-IP Encapsulation'),(98,'ENCAP','Encapsulation Header'),(99,'scheme','any private encryption scheme'),(100,'GMTP','GMTP'),(101,'IFMP','Ipsilon Flow Management Protocol'),(102,'PNNI','PNNI over IP'),(103,'PIM','Protocol Independent Multicast'),(104,'ARIS','ARIS'),(105,'SCPS','SCPS'),(106,'QNX','QNX'),(107,'A/N','Active Networks'),(108,'IPComp','IP Payload Compression Protocol'),(109,'SNP','Sitara Networks Protocol'),(110,'Compaq-Peer','Compaq Peer Protocol'),(111,'IPX-in-IP','IPX in IP'),(112,'VRRP','Virtual Router Redundancy Protocol'),(113,'PGM','PGM Reliable Transport Protocol'),(114,'0-hop','any 0-hop protocol'),(115,'L2TP','Layer Two Tunneling Protocol'),(116,'DDX','D-II Data Exchange (DDX)'),(117,'IATP','Interactive Agent Transfer Protocol'),(118,'STP','Schedule Transfer Protocol'),(119,'SRP','SpectraLink Radio Protocol'),(120,'UTI','UTI'),(121,'SMP','Simple Message Protocol'),(122,'SM (deprecated)','Simple Multicast Protocol'),(123,'PTP','Performance Transparency Protocol'),(124,'ISIS over IPv4',''),(125,'FIRE',''),(126,'CRTP','Combat Radio Transport Protocol'),(127,'CRUDP','Combat Radio User Datagram'),(128,'SSCOPMCE',''),(129,'IPLT',''),(130,'SPS','Secure Packet Shield'),(131,'PIPE','Private IP Encapsulation within IP'),(132,'SCTP','Stream Control Transmission Protocol'),(133,'FC','Fibre Channel'),(134,'RSVP-E2E-IGNORE',''),(135,'Mobility Header',''),(136,'UDPLite',''),(137,'MPLS-in-IP',''),(138,'manet','MANET Protocols'),(139,'HIP','Host Identity Protocol'),(140,'Shim6','Shim6 Protocol'),(141,'WESP','Wrapped Encapsulating Security Payload'),(142,'ROHC','Robust Header Compression'),(253,'test1','Use for experimentation and testing'),(254,'test2','Use for experimentation and testing'),(255,'Reserved','');
/*!40000 ALTER TABLE `ipobj_protocols` ENABLE KEYS */;
UNLOCK TABLES;

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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `policy_c_AFTER_INSERT` AFTER INSERT ON `policy_c` FOR EACH ROW BEGIN
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `policy_c_AFTER_UPDATE` AFTER UPDATE ON `policy_c` FOR EACH ROW BEGIN
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `policy_c_AFTER_DELETE` AFTER DELETE ON `policy_c` FOR EACH ROW BEGIN
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`policy_g_AFTER_INSERT` AFTER INSERT ON `policy_g` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`policy_g_AFTER_UPDATE` AFTER UPDATE ON `policy_g` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`policy_g_AFTER_DELETE` AFTER DELETE ON `policy_g` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `policy_r_AFTER_INSERT` AFTER INSERT ON `policy_r` FOR EACH ROW BEGIN
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `policy_r_AFTER_UPDATE` AFTER UPDATE ON `policy_r` FOR EACH ROW BEGIN
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `policy_r_AFTER_DELETE` AFTER DELETE ON `policy_r` FOR EACH ROW BEGIN
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`policy_r__interface_AFTER_INSERT` AFTER INSERT ON `policy_r__interface` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`policy_r__interface_AFTER_UPDATE` AFTER UPDATE ON `policy_r__interface` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`policy_r__interface_AFTER_DELETE` AFTER DELETE ON `policy_r__interface` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`policy_r__ipobj_AFTER_INSERT` AFTER INSERT ON `policy_r__ipobj` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`policy_r__ipobj_AFTER_UPDATE` AFTER UPDATE ON `policy_r__ipobj` FOR EACH ROW
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
/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `fwcloud_db`.`policy_r__ipobj_AFTER_DELETE` AFTER DELETE ON `policy_r__ipobj` FOR EACH ROW
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

-- Dump completed on 2018-05-26 13:48:05
