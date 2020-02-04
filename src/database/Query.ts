import db from "./DatabaseService";
import { QueryRunner, Connection } from "typeorm";
import * as sqlstring from "sqlstring";

export default class Query {

    public query(query:string, params: Array<any>, callback: (err:any, result: any) => void);
    public query(query: string, callback: (err: any, result: any) => void);
    public query(query: string, params: any = [] , callback?: (err: any, result: any) => void): void {
        
        const queryRunner: QueryRunner = db.getQueryRunner();

        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        queryRunner.query(query, params).then((result) => {
            queryRunner.release();
            if (callback) {
                callback(null, result);
            }
        }).catch((err) => {
            queryRunner.release();
            if (callback) {
                callback(err, null);
            }
        });
    }

    public escape(value: any): String {
        return sqlstring.escape(value);
    }

    public escapeId(value: any): String {
        return sqlstring.escapeId(value);
    }
}