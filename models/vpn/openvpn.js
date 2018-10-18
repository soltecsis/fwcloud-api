//create object
var openvpnModel = {};

var utilsModel = require("../../utils/utils.js");

var config = require('../../config/config');
const spawn = require('child-process-promise').spawn;

// Execute EASY-RSA command.
openvpnModel.runEasyRsaCmd = (fwcloud,easyrsaData) => {
	return new Promise((resolve, reject) => {
    const pki_dir = '--pki-dir=' + config.get('pki').data_dir + '/' + fwcloud;
    var argv = ['--batch',pki_dir];

    switch(easyrsaData.cmd) {
      case 'init-pki':
      case 'gen-crl':
      argv.push(easyrsaData.cmd);
      break;

      case 'build-ca':
      argv.push('--days='+easyrsaData.days);
      argv.push('--req-cn='+easyrsaData.cn);
      argv.push(easyrsaData.cmd);
      if (easyrsaData.nopass)
        argv.push('nopass');
      break;

      case 'build-server-full':
      argv.push('--days='+easyrsaData.days);
      argv.push(easyrsaData.cmd);
      argv.push(easyrsaData.cn);
      if (easyrsaData.nopass)
        argv.push('nopass');
      break;
    }
    const promise = spawn(config.get('pki').easy_rsa_cmd, argv);
    const childProcess = promise.childProcess;

    childProcess.stdout.on('data', data => console.log('stdout: ', data.toString()) );
    childProcess.stderr.on('data', data => console.log('stderr: ', data.toString()) );

    promise.then(() => resolve())
    .catch(error => reject(error));
	});
};

//Export the object
module.exports = openvpnModel;