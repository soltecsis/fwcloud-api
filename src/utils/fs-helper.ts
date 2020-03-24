import * as fs from "fs";
import * as fse from "fs-extra";

export class FSHelper {
    public static async directoryExists(path: fs.PathLike): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            fs.stat(path, (error: Error, stats: fs.BigIntStats) => {
                if (error) {
                    return resolve(false);
                }

                return resolve(stats.isDirectory());
            });
        })
    }

    public static directoryExistsSync(path: fs.PathLike): boolean {
        try {
            const stat: fs.Stats = fs.statSync(path);
            
            if (!stat || !stat.isDirectory()) {
                throw new Error();
            }
        } catch {
            return false;
        }

        return true;
    }

    public static async mkdir(path: string): Promise<void> {
        return fse.mkdirp(path);
    }

    public static async mkdirSync(path: string): Promise<void> {
        return fse.mkdirpSync(path);
    }

    public static async remove(path: string): Promise<void> {
        return fse.remove(path);
    }

    public static async copyDirectory(source: string, destination: string): Promise<void> {
        return fse.copy(source, destination);
    }
}