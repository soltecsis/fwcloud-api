import * as fs from "fs";
import path from "path";

export class FileInfo {

    stats: fs.Stats;
    extension: string;
    filename: string;
    dirname: string;
    filepath: string;

    constructor(info: {stats: fs.Stats, extension: string, filename: string, dirname: string, filepath: string}) {
        this.stats = info.stats;
        this.extension = info.extension;
        this.filename = info.filename;
        this.dirname = info.dirname;
        this.filepath = info.filepath;
    }
    
}
export class RequestFiles {
    protected _files: {[input: string]: FileInfo}

    constructor() {
        this._files = {};
    }
    
    public addFile(input: string, temporalPath: string): FileInfo {
        this._files[input] = new FileInfo({
            stats: fs.statSync(temporalPath),
            extension: path.extname(temporalPath),
            filename: path.basename(temporalPath),
            dirname: path.dirname(temporalPath),
            filepath: temporalPath
        });

        return this._files[input];
    }

    public has(input: string): boolean {
        return this._files.hasOwnProperty(input);
    }

    public get(input: string): FileInfo {
        if (this.has(input)) {
            return this._files[input];
        }

        return null;
    }
}