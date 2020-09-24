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

import yargs, { PositionalOptionsType } from "yargs";
import { Application } from "./Application";
import { Output } from "./output";

export type Option = {name: string, alias?: string, description: string, type?: "array" | "count" | PositionalOptionsType, required?: boolean, default?: any}
export type Argument = {name: string, description: string, required: boolean };

export abstract class Command {
    protected output: Output;
    protected _app: Application;

    public abstract name: string;
    public abstract description: string;

    public abstract handle(args: yargs.Arguments): Promise<void>;

    public async safeHandle(args: yargs.Arguments): Promise<number> {
        this._app = await Application.run();
        this.output = new Output(this._app.config.get('env') !== 'test' ? console.log : () => {});

        try {

            await this.handle(args);
            await this._app.close();
            
            return 0;

        } catch (err) {
            this.output.error('Unexpected error: ' + err.message);
            
            if(this._app.config.get('env') === 'test') { 
                throw err;
            }
            
            return 1;
        }
    }
    public getArguments(): Argument[]
    {
        return [];
    }

    public getOptions(): Option[]
    {
        return [];
    }
}