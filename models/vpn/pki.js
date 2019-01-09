//create object
var pkiModel = {};

var config = require('../../config/config');
const spawn = require('child-process-promise').spawn;
const readline = require('readline');
const fs = require('fs');
 

// Insert new CA in the database.
pkiModel.createCA = req => {
	return new Promise((resolve, reject) => {
    const ca = {
      fwcloud: req.body.fwcloud,
      cn: req.body.cn,
      days: req.body.days,
      comment: req.body.comment
    }
    req.dbCon.query('insert into ca SET ?', ca, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

// Delete CA.
pkiModel.deleteCA = req => {
	return new Promise((resolve, reject) => {
    // Verify that the CA can be deleted.
    req.dbCon.query('SELECT count(*) AS n FROM crt WHERE ca='+req.body.ca, (error, result) => {
      if (error) return reject(error);
      if (result[0].n > 0) return reject(new Error('This CA can not be removed because it still has certificates'));

      req.dbCon.query('DELETE FROM ca WHERE id='+req.body.ca, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  });
};




// Insert new certificate in the database.
pkiModel.createCRT = req => {
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
pkiModel.deleteCRT = req => {
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
pkiModel.getCRTdata = (dbCon,crt) => {
	return new Promise((resolve, reject) => {
    dbCon.query('SELECT * FROM crt WHERE id='+crt, (error, result) => {
      if (error) return reject(error);
      if (result.length!==1) return reject(new Error('CRT not found'));

      resolve(result[0]);
    });
  });
};

// Execute EASY-RSA command.
pkiModel.runEasyRsaCmd = (req,easyrsaDataCmd) => {
	return new Promise((resolve, reject) => {
    const pki_dir = '--pki-dir=' + config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + req.caId;
    var argv = ['--batch',pki_dir];

    switch(easyrsaDataCmd) {
      case 'init-pki':
      case 'gen-crl':
      case 'gen-dh':
      argv.push(easyrsaDataCmd);
      break;

      case 'build-ca':
      argv.push('--days='+req.body.days);
      argv.push('--req-cn='+req.body.cn);
      argv.push(easyrsaDataCmd);
      if (!req.body.pass)
        argv.push('nopass');
      break;

      case 'build-server-full':
      case 'build-client-full':
      argv.push('--days='+req.body.days);
      argv.push(easyrsaDataCmd);
      argv.push(req.body.cn);
      if (!req.body.nopass)
        argv.push('nopass');
      break;
    }
    const promise = spawn(config.get('pki').easy_rsa_cmd, argv);
    const childProcess = promise.childProcess;

   if (!req.body.nopass)
      childProcess.stdin.push('mipass');

    childProcess.stdout.on('data', data => console.log('stdout: ', data.toString()) );
    childProcess.stderr.on('data', data => console.log('stderr: ', data.toString()) );
    //childProcess.stdin.push('TEST');

    promise.then(result => resolve(result))
    .catch(error => reject(error));
	});
};

// Get certificate serial number.
pkiModel.delFromIndex = (dir,cn) => {
	return new Promise((resolve, reject) => {
    var serial = '';
    const substr = 'CN='+cn+'\n';
    const src_path = dir+'/index.txt';
    const dst_path = dir+'/index.txt.TMP';
    var rs = fs.createReadStream(src_path);
    var ws = fs.createWriteStream(dst_path);

    rs.on('error',error => reject(error));
    ws.on('error',error => reject(error));

    const rl = readline.createInterface({
      input: rs,
      crlfDelay: Infinity
    });

    rl.on('line', line => {
      const line2 = line + '\n';
      if(line2.indexOf(substr) > -1) {
        serial = line.split('\t')[3];
      } else ws.write(line2);
    });

    rl.on('close', () => {
      ws.close();
      fs.unlink(src_path, error => {
        if (error) return reject(error);
        fs.rename(dst_path,src_path, error => {
          if (error) return reject(error);
          resolve(serial);
        });
      });
    });
  });
};

//Export the object
module.exports = pkiModel;