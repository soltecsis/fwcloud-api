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
import { FSHelper } from "../utils/fs-helper";
import { EventEmitter } from "events";
import { FileInfo } from "../fonaments/http/files/file-info";

export class RequestBuilder extends Middleware {
    /**
     * Handles the incoming request.
     * 
     * @param req - The incoming request object.
     * @param res - The response object.
     * @param next - The next function in the middleware chain.
     * @returns A Promise that resolves to void.
     */
    public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        let filesProcessing: number = 0;
        const eventEmitter = new EventEmitter();
        
        req.inputs = new RequestInputs(req);
        
        if (!req.headers["content-type"] || ! new RegExp(/^multipart\/form-data;/i).test(req.headers["content-type"])) {
            return next();
        }

        try {
            const busboy = Busboy({ headers: req.headers });

            busboy.on('file', (input: string, file: NodeJS.ReadableStream, filename: any) => {
                filesProcessing++;
                const id: string = uuid.v4();
                const uploadFile: NodeJS.ReadableStream = file;
                const destinationPath: string = path.join(this.app.config.get('tmp.directory'), id, filename.filename);
                const destinationDirectory: string = path.dirname(destinationPath)
            
                FSHelper.mkdirSync(destinationDirectory);
                const destinationStream: fs.WriteStream = fs.createWriteStream(destinationPath);

                destinationStream.on('close', () => {
                    req.body[input] = new FileInfo(destinationPath);
                    setTimeout(() => {
                        if (FSHelper.directoryExistsSync(destinationDirectory)) {
                            FSHelper.rmDirectorySync(destinationDirectory);
                        }
                    }, 300000);
    
                    filesProcessing = filesProcessing - 1 >= 0 ? filesProcessing -1 : 0;
                    
                    eventEmitter.emit('file:done');
                });

                uploadFile.pipe(destinationStream);
                
            });

            busboy.on('finish', () => {
                eventEmitter.on('file:done', () => {
                    if(filesProcessing <= 0) {
                        eventEmitter.removeAllListeners();
                        return next();
                    }
                });

                eventEmitter.emit('file:done');
            });

            req.pipe(busboy);
        } catch(e) {
            return next(e);
        }
    }
}