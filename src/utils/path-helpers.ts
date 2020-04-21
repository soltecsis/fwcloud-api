import * as fs from "fs";
import * as path from "path";

export class PathHelper {

    /**
     * Returns the directory name from a directory path
     * 
     * @param directoryPath 
     */
    public static directoryName(directoryPath: fs.PathLike): string {
        return directoryPath.toString().split(path.sep).pop()
    }
}