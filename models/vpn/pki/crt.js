//create object
var pkiCRTModel = {};

var config = require('../../../config/config');
const fwcTreeModel = require('../../tree/tree');
const openvpnModel = require('../../models/vpn/openvpn');
const policyPrefixModel = require('../../policy/prefix');
const spawn = require('child-process-promise').spawn;
const readline = require('readline');
const fs = require('fs');



// Insert new certificate in the database.
pkiCRTModel.createCRT = req => {
	return new Promise((resolve, reject) => {
    const cert = {
      ca: req.body.ca,
      cn: req.body.cn,
      days: req.body.days,
      type: req.body.type,
      comment: req.body.comment
    }
    req.dbCon.query('insert into crt SET ?', cert, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

// Delete CRT.
pkiCRTModel.deleteCRT = req => {
	return new Promise((resolve, reject) => {
    // Verify that the CA can be deleted.
    req.dbCon.query('SELECT count(*) AS n FROM openvpn WHERE crt='+req.body.crt, (error, result) => {
      if (error) return reject(error);
      if (result[0].n > 0) return reject(new Error('This certificate can not be removed because it is used in a OpenVPN setup'));

      req.dbCon.query('DELETE FROM crt WHERE id='+req.body.crt, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  });
};

// Get database certificate data.
pkiCRTModel.getCRTdata = (dbCon,crt) => {
	return new Promise((resolve, reject) => {
    dbCon.query('SELECT * FROM crt WHERE id='+crt, (error, result) => {
      if (error) return reject(error);
      if (result.length!==1) return reject(new Error('CRT not found'));

      resolve(result[0]);
    });
  });
};

// Get certificate list for a CA.
pkiCRTModel.getCRTlist = (dbCon,ca) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`SELECT * FROM crt WHERE ca=${ca}`, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

//Export the object
module.exports = pkiCRTModel;