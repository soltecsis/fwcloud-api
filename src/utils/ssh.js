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

const logger = require('../fonaments/abstract-application').logger;

//create object
var sshTools = {};
//Export the object
module.exports = sshTools;

/*----------------------------------------------------------------------------------------------------------------------*/
sshTools.uploadFile = (SSHconn, srcFile, dstFile) => {
  var Client = require('ssh2').Client;
	var conn = new Client();

	logger().debug("SSH Upload File: ", srcFile, dstFile);

	return new Promise((resolve,reject) => { 
		conn.on('ready', () => {
			conn.sftp((err, sftp) => {
				if (err)  return reject(err);

				var fs = require("fs"); // Use node filesystem
        var readStream = fs.createReadStream(srcFile).on('error',error => {conn.end(); reject(error)});
        var writeStream = sftp.createWriteStream(dstFile).on('error',error => {conn.end(); reject(error)});

				writeStream
					.on('close',() => resolve( "File transferred succesfully"))
					.on('end', () => {conn.close(); reject("sftp connection closed")});

        // initiate transfer of file
				readStream.pipe(writeStream);
			});
		})
		.on('error',error => reject(error))
		.connect(SSHconn);
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
sshTools.uploadStringToFile = (SSHconn, str, dstFile) => {
  var Client = require('ssh2').Client;
	var conn = new Client();

	return new Promise((resolve,reject) => { 
		conn.on('ready', () => {
			conn.sftp((err, sftp) => {
				if (err)  return reject(err);

				var writeStream = sftp.createWriteStream(dstFile).on('error',error => {conn.end(); reject(error)});
				
				writeStream
					.on('close',() => resolve( "File transferred succesfully"))
					.on('end', () => {conn.close(); reject("sftp connection closed")});

				writeStream.write(str, error => {
					if (error) return reject(error);
					writeStream.end();
				});
			});
		})
		.on('error',error => reject(error))
		.connect(SSHconn);
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
sshTools.runCommand = (SSHconn, cmd) => {
  var Client = require('ssh2').Client;
	var conn = new Client();
	var stdout_log = "";
	var stderr_log ="";
	let sudo_pass_sent = 0;

	return new Promise((resolve,reject) => { 
		conn.on('ready',() => {
			conn.exec(cmd, {pty: true}, (err, stream) => {
				if (err) return reject(err);
				stream.on('close',(code, signal) => {
					//console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
					conn.end();
					if (code===0)
						resolve(stdout_log)
					else
						reject(new Error("STDOUT: \n"+stdout_log+"\n\nSTDERR: \n"+stderr_log));
				}).on('data', data => {
					//console.log('STDOUT: ' + data);
					var str=""+data;
					if (!sudo_pass_sent) {
						let regex = new RegExp(`\\[sudo\\] .* ${SSHconn.username}: `);
						if (str.match(regex)) {
							stream.write(SSHconn.password+"\n");
							sudo_pass_sent = 1;
						}
					}
					stdout_log += data;
				}).stderr.on('data', data => {
					//console.log('STDERR: ' + data);
					stderr_log += data;
				});
			});
		})
		.on('error', error => reject(error))
		.connect(SSHconn);
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/
