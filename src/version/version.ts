import moment, { Moment } from "moment";
import { promises as fs} from "fs";
import { VersionFileNotFoundException } from "./exceptions/version-file-not-found.exception";
import { Responsable } from "../fonaments/contracts/responsable";

export class Version implements Responsable {
    version: string;
    date: Moment;

    constructor(version?: string, date?: Moment) {
        this.version = version;
        this.date = date;
    }

    public async saveVersionFile(versionFilePath: string): Promise<Version> {
        const fileData: string = JSON.stringify({version: this.version, date: this.date.utc()}, null, 2);

        await fs.writeFile(versionFilePath, fileData);

        return this;
    }

    public async loadVersionFile(versionFilePath: string): Promise<Version> {

        try {
            if ((await fs.stat(versionFilePath)).isFile()) {
                const content: string = (await fs.readFile(versionFilePath)).toString();
                const jsonContent: {version: string, date: string} = JSON.parse(content);
                this.version = jsonContent.version;
                this.date = moment(jsonContent.date) || moment();

                return this;
            }
        } catch(e) {}

        throw new VersionFileNotFoundException(versionFilePath);
    }

    toResponse(): object {
        return {
            version: this.version,
            date: this.date.utc()
        }
    }
    
}