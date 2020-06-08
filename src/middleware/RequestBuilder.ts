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

import { Middleware } from "../fonaments/http/middleware/Middleware";
import { Request, Response, NextFunction } from "express";
import { RequestInputs } from "../fonaments/http/request-inputs";
import Busboy from 'busboy';
import * as fs from "fs";
import * as uuid from "uuid";
import path from "path";
import { RequestFiles } from "../fonaments/http/request-files";
import { FSHelper } from "../utils/fs-helper";
import { logger } from "../fonaments/abstract-application";

export class RequestBuilder extends Middleware {
    public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        let filesProcessing: number = 0;
        let finished: boolean = false;
        req.inputs = new RequestInputs(req);
        req.files = new RequestFiles();
        
        if (!req.headers["content-type"] || ! new RegExp(/^multipart\/form-data;/i).test(req.headers["content-type"])) {
            return next();
        }

        try {
            var busboy = new Busboy({ headers: req.headers });

            busboy.on('file', async (input: string, file: NodeJS.ReadableStream, filename: string) => {
                filesProcessing++;
                const id: string = uuid.v4();
                const uploadFile: NodeJS.ReadableStream = file;
                const destinationPath: string = path.join(this.app.config.get('tmp.directory'), id, filename);
                const destinationDirectory: string = path.dirname(destinationPath)
                
                FSHelper.mkdirSync(destinationDirectory);

                uploadFile.pipe(fs.createWriteStream(destinationPath));
                req.files.addFile(input, destinationPath);
                filesProcessing = filesProcessing - 1 >= 0 ? filesProcessing -1 : 0;

                if (finished && filesProcessing === 0) {
                    return next();
                }

                setTimeout(() => {
                    if (FSHelper.directoryExistsSync(destinationDirectory)) {
                        FSHelper.rmDirectorySync(destinationDirectory);
                    }
                }, 300000);
            });

            busboy.on('finish', () => {
                if(filesProcessing > 0) {
                    finished = true;
                    return;
                }

                return next();
            });

            req.pipe(busboy);
        } catch(e) {
            logger().warn(e.message);
            return next();
        }
    }
}