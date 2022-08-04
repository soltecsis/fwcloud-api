import yauzl from 'yauzl';
import { FSHelper } from './fs-helper';
import * as path from "path";
import * as fs from "fs";
import archiver from 'archiver';

export class Zip {


    /**
     * Unzip a zip file into the destinationPath
     * 
     * @param zipPath 
     * @param destinationPath 
     */
    public static unzip(zipPath: string, destinationPath: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {

            yauzl.open(zipPath, { lazyEntries: true }, function (err, zipfile) {
                if (err) {
                    return reject(err);
                };

                if(!fs.existsSync(destinationPath)) {
                    FSHelper.mkdirSync(destinationPath);
                }
                
                zipfile.on("entry", (entry) => {
                    if (/\/$/.test(entry.fileName)) {
                        // Entry is a directory as file names end with '/'.
                        FSHelper.mkdirSync(path.join(destinationPath, entry.fileName));
                        zipfile.readEntry();
                    } else {
                        // file entry
                        zipfile.openReadStream(entry, function (err, readStream) {
                            if (err) {
                                return reject(err);
                            };
                            readStream.on("end", function () {
                                zipfile.readEntry();
                            });
                            const ws: fs.WriteStream = fs.createWriteStream(path.join(destinationPath, entry.fileName));
                            readStream.pipe(ws);
                        });
                    }
                });

                zipfile.on('error', (err) => {
                    return reject(err);
                });

                zipfile.on('end', async () => {
                    return resolve()
                });
                
                zipfile.readEntry();
            });
        });
    }

    public static zip(workPath: string, destinationPath: string = null, extension = null): Promise<void> {
        if (destinationPath === null) {
            destinationPath = workPath + '.zip';
        }
        
        return new Promise<void>((resolve, reject) => {
            if (!fs.existsSync(workPath)) {
                return reject(new Error(`Directory does not exist for being zipped: ${workPath}`))
            }
            const output = fs.createWriteStream(destinationPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', async () => {
                return resolve();
            });

            // good practice to catch warnings (ie stat failures and other non-blocking errors)
            archive.on('warning', (error: any) => {
                if (error.code === 'ENOENT') {
                    console.warn(error);
                } else {
                    return reject(error);
                }
            });

            // good practice to catch this error explicitly
            archive.on('error', (err) => {
                return reject(err);
            });

            // pipe archive data to the file
            archive.pipe(output);

            archive.directory(workPath, false);
            archive.finalize();
        });
    }

    public static zipFile(filePath: string, destinationPath: string = null, extension = null): Promise<void> {

        const fileName = path.basename(filePath);

        return new Promise<void>((resolve, reject) => {

            fs.open(filePath ,'r', function (err) {
                if(err) {
                    return reject(new Error(`File does not exist for being zipped: ${filePath}`))
                }
            });
            const output = fs.createWriteStream(destinationPath + `/${fileName}.zip`);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', async () => {
                return resolve();
            });

            // good practice to catch warnings (ie stat failures and other non-blocking errors)
            archive.on('warning', (error: any) => {
                if (error.code === 'ENOENT') {
                    console.warn(error);
                } else {
                    return reject(error);
                }
            });

            // good practice to catch this error explicitly
            archive.on('error', (err) => {
                return reject(err);
            });

            // pipe archive data to the file
            archive.pipe(output);
            const fileToZip =   path.join(destinationPath, fileName);
            archive.append(fs.createReadStream(fileToZip), { name: fileName });
            
            archive.finalize();
        });
    }
}