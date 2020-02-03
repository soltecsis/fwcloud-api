import db from "./DatabaseService";
import { QueryRunner, Connection } from "typeorm";
import * as sqlstring from "sqlstring";

export default class Query {

    public query(query: string, callback: (err: any, result: any) => void): void {
        const queryRunner: QueryRunner = db.getQueryRunner();

        queryRunner.query(query).then((result) => {
            queryRunner.release();
            callback(null, result);
        }).catch((err) => {
            queryRunner.release();
            callback(err, null);
        });
    }

    public escape(value: any): String {
        return sqlstring.escape(value);
    }

    public escapeId(value: any): String {
        return sqlstring.escapeId(value);
    }
}