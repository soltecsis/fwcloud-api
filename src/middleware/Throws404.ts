import { Middleware } from "../fonaments/http/middleware/Middleware";
import { Request, Response, NextFunction } from "express";
import { NotFoundException } from "../fonaments/exceptions/not-found-exception";

export class Throws404 extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction) {
        next(new NotFoundException());
    }
}