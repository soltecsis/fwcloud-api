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

import { Rule } from "./rule";
import { FileInfo } from "../../http/files/file-info";

export class Extension extends Rule
{
    protected _extension: string;

    constructor(extension: string) {
        super();
        this._extension = extension;
    }

    public async passes(attribute: string, value: any): Promise<boolean> {
        if (value === undefined || value === null || value instanceof FileInfo === false) {
            return true;
        }

        return value.filepath.endsWith(`.${this._extension}`);    
    }

    public message(attribute: string, value: any): string {
        return `${attribute} must have '.${this._extension}' extension.`
    }
    
}