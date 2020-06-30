import { Rule } from "./rule";
import { FileInfo } from "../../http/files/file-info";

export class File extends Rule {

    public async passes(attribute: string, value: any): Promise<boolean> {
        if (value === undefined || value === null || value instanceof FileInfo) {
            return true;
        }

        return false;
    }
    
    public message(attribute: string, value: any): string {
        return `${attribute} must be a file.`
    }

}