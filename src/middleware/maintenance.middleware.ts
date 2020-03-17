import { Middleware } from "../fonaments/http/middleware/Middleware";
import { Request, Response, NextFunction } from "express";
import { ServiceUnavailableException } from "../fonaments/exceptions/service-unavailable.exception";

export class MaintenanceMiddleware extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction) {
        if (this.app.config.get('maintenance_mode')) {
            return next(new ServiceUnavailableException())
        }
        
        return next();
    }
    
}