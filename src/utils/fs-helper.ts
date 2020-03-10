import { promises as fs, Stats, PathLike } from "fs";
import * as fse from "fs-extra";

export class FSHelper {
    public static async directoryExists(path: PathLike): Promise<boolean> {
        try {
            const stat: Stats = await fs.stat(path);
            
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

    public static async remove(path: string): Promise<void> {
        return fse.remove(path);
    }

    public static async copyDirectory(source: string, destination: string): Promise<void> {
        return fse.copy(source, destination);
    }
}