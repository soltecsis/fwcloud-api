import { Request } from "express";

export class Gate {
    public async grant(request: Request): Promise<boolean> {
        return false;
    }
}