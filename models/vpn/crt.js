//create object
var crtModel = {};

var config = require('../../config/config');
const spawn = require('child-process-promise').spawn;

// Insert new CA in the database.
crtModel.createNewCA = req => {
	return new Promise((resolve, reject) => {
    const ca = {
      fwcloud: req.body.fwcloud,
      cn: req.body.cn,
      days: req.body.days
    }
    req.dbCon.query('insert into ca SET ?', ca, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

// Insert new certificate in the database.
crtModel.createNewCert = req => {
	return new Promise((resolve, reject) => {
    const cert = {
      ca: req.body.ca,
      cn: req.body.cn,
      days: req.body.days,
      type: req.body.type
    }
    req.dbCon.query('insert into cert SET ?', cert, (error, result) => {
      if (error) return reject(error);
      resolve(result.insertId);
    });
  });
};

// Execute EASY-RSA command.
crtModel.runEasyRsaCmd = (req,easyrsaDataCmd) => {
	return new Promise((resolve, reject) => {
    const pki_dir = '--pki-dir=' + config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + req.caId;
    var argv = ['--batch',pki_dir];

    switch(easyrsaDataCmd) {
      case 'init-pki':
      case 'gen-crl':
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
    childProcess.stdin.push('mipass');

    promise.then(result => resolve(result))
    .catch(error => reject(error));
	});
};

//Export the object
module.exports = crtModel;