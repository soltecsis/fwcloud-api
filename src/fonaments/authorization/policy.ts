import { AuthorizationService } from "./authorization.service";
import { app } from "../abstract-application";

export abstract class AuthorizationResponse {
    protected _authorizationService: AuthorizationService;
    
    constructor() {
        this._authorizationService = app().getService(AuthorizationService.name);
    }

    async authorize(): Promise<void> {
        await this._authorizationService.revokeAuthorization();
    }
    
    static revoke() {
        return new Unauthorized();
    }

    static grant() {
        return new Authorized();
    }
}

export class Authorized extends AuthorizationResponse {
    public async authorize() {
        //Nothing
    }
}

export class Unauthorized extends AuthorizationResponse {
    public async authorize() {
        await this._authorizationService.revokeAuthorization();
    }
}

export class Policy {
    protected _authorizationService: AuthorizationService;
    protected authorized: boolean;

    constructor() {
        this._authorizationService = app().getService(AuthorizationService.name);
        this.authorized = false;
    }
    
    protected authorize(): void {
        if (!this.authorized) {
            this._authorizationService.revokeAuthorization();
        }
        this.authorized = false;
    }
}