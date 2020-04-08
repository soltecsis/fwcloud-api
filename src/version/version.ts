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

import moment, { Moment } from "moment";
import { promises as fs} from "fs";
import { VersionFileNotFoundException } from "./exceptions/version-file-not-found.exception";
import { Responsable } from "../fonaments/contracts/responsable";

export class Version implements Responsable {
    tag: string;
    schema: string;
    date: Moment;

    constructor() {
        this.tag = null;
        this.date = null;
        this.schema = null;
    }

    public async saveVersionFile(versionFilePath: string): Promise<Version> {
        const fileData: string = JSON.stringify({version: this.tag, date: this.date.utc(), schema: this.schema }, null, 2);

        await fs.writeFile(versionFilePath, fileData);

        return this;
    }

    public async loadVersionFile(versionFilePath: string): Promise<Version> {

        try {
            if ((await fs.stat(versionFilePath)).isFile()) {
                const content: string = (await fs.readFile(versionFilePath)).toString();
                const jsonContent: {version: string, date: string, schema: string } = JSON.parse(content);
                this.tag = jsonContent.version;
                this.date = moment(jsonContent.date) || moment();
                this.schema = jsonContent.schema

                return this;
            }
        } catch(e) {
            throw e;
        }

        throw new VersionFileNotFoundException(versionFilePath);
    }

    toResponse(): object {
        return {
            version: this.tag,
            schema: this.schema,
            date: this.date.utc()
        }
    }
    
}