/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import fwcError from './error_table';

export class PgpHelper {
  private _publicKey: string;
  private _privateKey: string;

  constructor(keyPair?: { public: string; private: string }) {
    if (keyPair) {
      this._publicKey = keyPair.public;
      this._privateKey = keyPair.private;
    }
  }

  get publicKey(): string {
    return this._publicKey;
  }

  get privateKey(): string {
    return this._privateKey;
  }

  public async init(rsaBits: number): Promise<void> {
    const { privateKey, publicKey } = await openpgp.generateKey({
      userIDs: [{ name: 'FWCloud.net', email: 'info@fwcloud.net' }],
      rsaBits: rsaBits,
      format: 'binary', // Change the format to 'binary'
    });

    if (!publicKey || !privateKey) throw fwcError.PGP_KEYS_GEN;

    this._publicKey = publicKey.toString();
    this._privateKey = privateKey.toString();
  }

  public async encrypt(msg: string): Promise<string> {
    const publicKey = await openpgp.readKey({
      armoredKey: this._publicKey,
    });
    const msgEncrypted = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: msg }),
      encryptionKeys: publicKey,
    });
    return JSON.stringify(msgEncrypted);
  }

  public async decrypt(msgEncrypted: string): Promise<string> {
    const privateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({
        armoredKey: this._privateKey,
      }),
    });

    const msg = await openpgp.decrypt({
      message: await openpgp.readMessage({ armoredMessage: msgEncrypted }),
      decryptionKeys: privateKey,
    });

    return JSON.stringify(msg.data);
  }
}
