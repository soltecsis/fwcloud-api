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
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { ProgressSSHCmdPayload } from '../sockets/messages/socket-message';
export default class sshTools {
  public static uploadFile(SSHconn, srcFile: string, dstFile) {
    const Client = require('ssh2').Client;
    const conn = new Client();

    logger().debug('SSH Upload File: ', srcFile, dstFile);

    return new Promise((resolve, reject) => {
      conn
        .on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) return reject(err);

            const fs = require('fs'); // Use node filesystem
            const readStream = fs.createReadStream(srcFile).on('error', (error) => {
              conn.end();
              reject(error);
            });
            const writeStream = sftp.createWriteStream(dstFile).on('error', (error) => {
              conn.end();
              reject(error);
            });

            writeStream
              .on('close', () => resolve('File transferred succesfully'))
              .on('end', () => {
                conn.close();
                reject('sftp connection closed');
              });

            // initiate transfer of file
            readStream.pipe(writeStream);
          });
        })
        .on('error', (error) => {
          if (error.message) error.message = `SSH_ERROR(${error.level}): ${error.message}`;
          reject(error);
        })
        .connect(SSHconn);
    });
  }

  public static uploadStringToFile(SSHconn, str: string, dstFile: string) {
    const Client = require('ssh2').Client;
    const conn = new Client();

    return new Promise((resolve, reject) => {
      conn
        .on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) return reject(err);

            const writeStream = sftp.createWriteStream(dstFile).on('error', (error) => {
              conn.end();
              reject(error);
            });

            writeStream
              .on('close', () => resolve('File transferred succesfully'))
              .on('end', () => {
                conn.close();
                reject('sftp connection closed');
              });

            writeStream.write(str, (error) => {
              if (error) return reject(error);
              writeStream.end();
            });
          });
        })
        .on('error', (error) => {
          if (error.message) error.message = `SSH_ERROR(${error.level}): ${error.message}`;
          reject(error);
        })
        .connect(SSHconn);
    });
  }

  public static runCommand(SSHconn, cmd, eventEmitter?: EventEmitter): Promise<string> {
    const Client = require('ssh2').Client;
    const conn = new Client();
    let stdout_log = '';
    let stderr_log = '';
    let sudo_pass_sent = cmd.trim().substr(0, 5) === 'sudo ' ? false : true;
    const regex = new RegExp(`\\[sudo\\] .* ${SSHconn.username}: `);

    return new Promise((resolve, reject) => {
      conn
        .on('ready', () => {
          conn.exec(cmd, { pty: true }, (err, stream) => {
            if (err) return reject(err);

            let prevStr = '';

            stream
              .on('close', (code) => {
                //console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                conn.end();
                if (code === 0) resolve(stdout_log);
                else reject(new Error('STDOUT: \n' + stdout_log + '\n\nSTDERR: \n' + stderr_log));
              })
              .on('data', (data) => {
                //console.log('STDOUT: ' + data);
                const str = '' + data;

                if (!sudo_pass_sent && str.match(regex)) {
                  stream.write(SSHconn.password + '\n');
                  sudo_pass_sent = true;
                } else {
                  stdout_log += data;
                  if (eventEmitter) {
                    if (prevStr === '\r\n' && str === '\r\n')
                      // Blanc line
                      eventEmitter.emit('message', new ProgressSSHCmdPayload('\r\n'));
                    else if (str != '\r\n')
                      eventEmitter.emit('message', new ProgressSSHCmdPayload(str));

                    prevStr = str;
                  }
                }
              })
              .stderr.on('data', (data) => {
                //console.log('STDERR: ' + data);
                stderr_log += data;
              });
          });
        })
        .on('error', (error) => {
          if (error.message) error.message = `SSH_ERROR(${error.level}): ${error.message}`;
          reject(error);
        })
        .connect(SSHconn);
    });
  }
}
