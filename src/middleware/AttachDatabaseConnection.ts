import { Middleware } from "../fonaments/http/middleware/Middleware";
import { Request, Response, NextFunction } from "express";
import db from "../database/DatabaseService";

export class AttachDatabaseConnection extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction): void {
        req.dbCon = db.getQuery();
        next();
    }

}