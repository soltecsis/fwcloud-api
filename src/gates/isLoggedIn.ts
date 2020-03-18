import { Gate } from "../fonaments/http/router/gate";
import { Request } from "express";

export class isLoggedIn extends Gate {
    public async grant(request: Request): Promise<boolean> {
        if (request.session.user !== null || request.session.user !== undefined) {
            return true;
        }

        return false;
    }
}