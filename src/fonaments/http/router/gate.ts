import { Request } from "express";
import { AuthorizationException } from "../../exceptions/authorization-exception";

export class Gate {
    public async grant(request: Request): Promise<boolean> {
        return false;
    }
}