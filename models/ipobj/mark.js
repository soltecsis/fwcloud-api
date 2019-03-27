//create object
var markModel = {};

const tableModel = 'mark';

// Verify if the iptables mark exists for the indicated fwcloud.
markModel.existsMark = (dbCon,fwcloud,code) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`SELECT id FROM ${tableModel} WHERE code=${code} AND fwcloud=${fwcloud}`, (error, result) => {
      if (error) return reject(error);
      resolve((result.length>0) ? result[0].id : 0);
    });
  });
};

// Add new iptables mark for the indicated fwcloud.
markModel.createMark = req => {
	return new Promise((resolve, reject) => {
    const markData = {
      fwcloud: req.body.fwcloud,
      code: req.body.code,
      name: req.body.name,
      comment: req.body.comment
    };
    req.dbCon.query(`INSERT INTO ${tableModel} SET ?`, markData, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

// Modify an iptables mark.
markModel.modifyMark = req => {
	return new Promise((resolve, reject) => {
    let sql = `UPDATE ${tableModel} SET code=${req.body.code}, name=${req.dbCon.escape(req.body.name)},
      comment=${req.dbCon.escape(req.body.comment)} WHERE id=${req.body.mark}`
    req.dbCon.query(sql, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

// Delete an iptables mark.
markModel.deleteMark = (dbCon,mark) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`DELETE from ${tableModel} WHERE id=${mark}`, (error, result) => {
      if (error) return reject(error);
      resolve();
    });
  });
};

markModel.getMark = (dbCon,mark) => {
	return new Promise((resolve, reject) => {
    dbCon.query(`select * from ${tableModel} WHERE id=${mark}`, (error, result) => {
      if (error) return reject(error);
      if (result.length!==1) return reject(new Error('Iptables mark not found'))
      resolve(result);
    });
  });
};



markModel.searchMarkInRule = (dbCon,fwcloud,mark) => {
	return new Promise((resolve, reject) => {
    var sql = `select R.id as rule, R.firewall, FW.id as firewall_id, FW.name as firewall_name,
      M.id obj_id, M.name obj_name,
      R.id as rule_id, R.type rule_type, 30 as obj_type_id,
			PT.name rule_type_name,
			FW.cluster as cluster_id, IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name
		 	from policy_r R
			inner join mark M on M.id=R.mark
			inner join firewall FW on FW.id=R.firewall
      inner join policy_type PT on PT.id=R.type
			where FW.fwcloud=${fwcloud} and R.mark=${mark}`;
		dbCon.query(sql, (error, rows) => {
			if (error) return reject(error);
			resolve(rows);
		});
	});
};

markModel.searchMarkUsage = (dbCon,fwcloud,mark) => {
	return new Promise(async (resolve, reject) => {
    try {
      let search = {};
      search.result = false;
      search.restrictions ={};

      search.restrictions.MarkInRule = await markModel.searchMarkInRule(dbCon,fwcloud,mark);
      
      for (let key in search.restrictions) {
        if (search.restrictions[key].length > 0) {
          search.result = true;
          break;
        }
      }
      resolve(search);
    } catch(error) { reject(error) }
  });
};



//Export the object
module.exports = markModel;

