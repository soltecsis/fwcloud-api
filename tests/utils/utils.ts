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

import { User } from "../../src/models/user/User";
import * as path from 'path';
import { app } from "../../src/fonaments/abstract-application";
import * as fs from "fs";
import moment from "moment";
import cookie from "cookie";
import signature from "cookie-signature";

export function randomString(length: number = 10) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export function generateSession(user: User): string {
    const session_id: string = randomString(10);
    const session_path: string = path.join(app().config.get('session').files_path, session_id + '.json');

    fs.writeFileSync(session_path, JSON.stringify({
        "cookie": {
            "originalMaxAge": 899998,
            "expires": moment().add(1, 'd').utc(),
            "secure": false,
            "httpOnly": false,
            "path": "/"
        },
        "customer_id": user.customer,
        "user_id": user.id,
        "username": user.username,
        "__lastAccess": moment().valueOf()
    }));

    return session_id;
}

export function attachSession(id: string): string {
    return cookie.serialize(app().config.get('session').name, signature.sign(id, app().config.get('crypt').secret), {});
}

export async function sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
    return;
}