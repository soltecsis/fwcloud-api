import { Gate } from "../fonaments/http/router/gate";
import { User } from "../models/user/User";
import { Request } from "express";

export class isAdmin extends Gate {
    public async grant(request: Request): Promise<boolean> {
        if (await User.isLoggedUserAdmin(request)) {
			return true;
		}
    }
}