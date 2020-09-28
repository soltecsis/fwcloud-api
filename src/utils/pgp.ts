/*!
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

const openpgp = require('openpgp');

export class PgpHelper {
    private _publicKey: string;
    private _privateKey: string;

    constructor (keyPair?: {public: string, private: string}) {
        if (keyPair) {
            this._publicKey = keyPair.public;
            this._privateKey = keyPair.private;
        }
    }

    get publicKey():string {
        return this._publicKey;
    }

    get privateKey():string {
        return this._privateKey;
    }

    public async init(rsaBits: number): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const { publicKeyArmored, privateKeyArmored } = await openpgp.generateKey({
                    userIds: [{ name: 'FWCloud.net', email: 'info@fwcloud.net' }], 
                    rsaBits: rsaBits     
                });
                this._publicKey = publicKeyArmored;
                this._privateKey = privateKeyArmored;
                resolve();
            } catch (error) { reject(error) }
        });
    }

    public encrypt(msg: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                const options = {
                    message: openpgp.message.fromText(msg), // input as Message object
                    publicKeys: (await openpgp.key.readArmored(this._publicKey)).keys // for encryption
                };
                const { data: msgEncrypted } = await openpgp.encrypt(options);
                //console.log(msgEncrypted);
                resolve(msgEncrypted);
            } catch (error) { reject(error); }
        });
    }

    public encryptWithPrivateKey(msg: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                const options = {
                    message: openpgp.message.fromText(msg), // input as Message object
                    publicKeys: (await openpgp.key.readArmored(this._privateKey)).keys // for encryption
                };
                const { data: msgEncrypted } = await openpgp.encrypt(options);
                //console.log(msgEncrypted);
                resolve(msgEncrypted);
            } catch (error) { reject(error); }
        });
    }

    public decrypt(msgEncrypted: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                const options = {
                    message: await openpgp.message.readArmored(msgEncrypted), // parse armored message
                    privateKeys: (await openpgp.key.readArmored(this._privateKey)).keys // for decryption
                }
                const { data: msg } = await openpgp.decrypt(options);
                //console.log(msg);
                resolve(msg);
            } catch (error) { reject(error); }
        });
    }
}