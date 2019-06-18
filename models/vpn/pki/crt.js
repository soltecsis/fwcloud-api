/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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


//create object
var pkiCRTModel = {};

const fwcError = require('../../../utils/error_table')


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
      if (result[0].n > 0) return reject(fwcError.other('This certificate can not be removed because it is used in a OpenVPN setup'));

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
      if (result.length!==1) return reject(fwcError.NOT_FOUND);

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


pkiCRTModel.searchCRTInOpenvpn = (dbCon,fwcloud,crt) => {
	return new Promise((resolve, reject) => {
    let sql = `SELECT VPN.id FROM openvpn VPN
      INNER JOIN crt CRT ON CRT.id=VPN.crt
      INNER JOIN ca CA ON CA.id=CRT.ca
      WHERE CA.fwcloud=${fwcloud} AND CRT.id=${crt}`;
    dbCon.query(sql, async (error, result) => {
      if (error) return reject(error);

      if (result.length > 0)
        resolve({result: true, restrictions: { crtUsedInOpenvpn: true}});
      else
        resolve({result: false});
    });
  });
};

//Export the object
module.exports = pkiCRTModel;