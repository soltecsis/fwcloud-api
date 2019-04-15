//create object
var sshTools = {};
//Export the object
module.exports = sshTools;

/*----------------------------------------------------------------------------------------------------------------------*/
sshTools.uploadFile = (SSHconn, srcFile, dstFile) => {
  var Client = require('ssh2').Client;
	var conn = new Client();

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
