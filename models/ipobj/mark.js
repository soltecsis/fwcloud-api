//create object
var markModel = {};

const fwcTreeModel = require('../../../models/tree/tree');

const tableModel = 'mark';

// Verify if the iptables mark exists for the indicated fwcloud.
markModel.existsMark = (dbCon,fwcloud,mark) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`SELECT id FROM ${tableModel} WHERE mark=${mark} AND fwcloud=${fwcloud}`, (error, result) => {
      if (error) return reject(error);
      resolve((result.length>0) ? true : false);
    });
  });
};

// Add new iptables mark for the indicated fwcloud.
markModel.createMark = req => {
	return new Promise((resolve, reject) => {
    const markData = {
      id: req.body.mark,
      name: req.body.name,
      comment: req.body.comment
    };
    req.dbCon.query(`INSERT INTO ${tableModel} SET ?`, markData, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};
