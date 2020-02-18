import { Service } from "../../services/Service";
import { PathParams } from "express-serve-static-core"
import { Request, Response, Router } from "express";
import { Controller } from "../Controller";
import { FunctionHelper } from "../../../utils/FunctionHelper";
import { AbstractApplication, app } from "../../AbstractApplication";
import { RouteCollection } from "./RouteCollection";
import { Routes } from "../../../routes/routes";

export type httpMethod = "ALL" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
export type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never;
declare function optionalParams(params:number, params2: string): void;


export class RouterService extends Service {
    protected _express: Express.Application;
    protected _router: Express.Application

    protected _routes: RouteCollection;

    constructor(_app: AbstractApplication) {
        super(_app);
        this._express = this._app.express;
        this._router = this._express;
    }

    public registerRoutes() {
        this._routes = new Routes(this._app, this._app.getService(RouterService.name));
    }

    public post(pathParams: PathParams, controller: typeof Controller, method: string, inputValidation?: any, policy?: any, action?: string): any
    public post(pathParams: PathParams, controller: (req: Request, res: Response) => void): any
    public post(pathParams: PathParams, controller: any, method?: string, inputValidation?: any, policy?: any, action?: string): any {
        return this.addRoute('POST', pathParams, controller, method, inputValidation, policy, action);
    }

    public get(pathParams: PathParams, controller: typeof Controller, method: string, inputValidation?: any, policy?: any, action?: string): any
    public get(pathParams: PathParams, controller: (req: Request, res: Response) => void): any
    public get(pathParams: PathParams, controller: any, method?: string, inputValidation?: any, policy?: any, action?: string): any {
        return this.addRoute('GET', pathParams, controller, method, inputValidation, policy, action);
    }

    public all(pathParams: PathParams, controller: typeof Controller, method: string, inputValidation?: any, policy?: any, action?: string): any
    public all(pathParams: PathParams, controller: (req: Request, res: Response) => void): any
    public all(pathParams: PathParams, controller: any, method?: string, inputValidation?: any, policy?: any, action?: string): any {
        return this.addRoute('ALL', pathParams, controller, method, inputValidation, policy, action);
    }

    public options(pathParams: PathParams, controller: typeof Controller, method: string, inputValidation?: any, policy?: any, action?: string): any
    public options(pathParams: PathParams, controller: (req: Request, res: Response) => void): any
    public options(pathParams: PathParams, controller: any, method?: string, inputValidation?: any, policy?: any, action?: string): any {
        return this.addRoute('OPTIONS', pathParams, controller, method, inputValidation, policy, action);
    }

    public delete(pathParams: PathParams, controller: typeof Controller, method: string, inputValidation?: any, policy?: any, action?: string): any
    public delete(pathParams: PathParams, controller: (req: Request, res: Response) => void): any
    public delete(pathParams: PathParams, controller: any, method?: string, inputValidation?: any, policy?: any, action?: string): any {
        return this.addRoute('DELETE', pathParams, controller, method, inputValidation, policy, action);
    }

    public head(pathParams: PathParams, controller: typeof Controller, method: string, inputValidation?: any, policy?: any, action?: string): any
    public head(pathParams: PathParams, controller: (req: Request, res: Response) => void): any
    public head(pathParams: PathParams, controller: any, method?: string, inputValidation?: any, policy?: any, action?: string): any {
        return this.addRoute('HEAD', pathParams, controller, method, inputValidation, policy, action);
    }

    public patch(pathParams: PathParams, controller: typeof Controller, method: string, inputValidation?: any, policy?: any, action?: string): any
    public patch(pathParams: PathParams, controller: (req: Request, res: Response) => void): any
    public patch(pathParams: PathParams, controller: any, method?: string, inputValidation?: any, policy?: any, action?: string): any {
        return this.addRoute('PATCH', pathParams, controller, method, inputValidation, policy, action);
    }

    public put(pathParams: PathParams, controller: typeof Controller, method: string, inputValidation?: any, policy?: any, action?: string): any
    public put(pathParams: PathParams, controller: (req: Request, res: Response) => void): any
    public put(pathParams: PathParams, controller: any, method?: string, inputValidation?: any, policy?: any, action?: string): any {
        return this.addRoute('PUT', pathParams, controller, method, inputValidation, policy, action);
    }

    private addRoute(httpMethod: httpMethod, pathParams: PathParams, controller: any, method?: string, inputValidation?: any, policy?: any, action?: string): any {
        if (FunctionHelper.isCallback(controller)) {
            return this.callWithCallback(httpMethod, pathParams, controller);
        }

        return this.callWithController(httpMethod, pathParams, controller, method, inputValidation, policy, action);    
    }

    private async callWithCallback(httpMethod: httpMethod, pathParams: PathParams, callback: (req: Request, res: Response) => void): Promise<void> {
        return this._router[httpMethod.toLowerCase()](pathParams, callback);
    }
    private async callWithController(httpMethod: httpMethod, pathParams, controller: typeof Controller, method: string, inputValidation?: any, policy?: any, action?: string): Promise<void> {
        return this._router[httpMethod.toLowerCase()](pathParams, async (req: Request, res: Response) => {
            
            if (!controller.methodExists(method)) {
                throw new Error('Method ' + method + ' does not exist in controller: ' + controller.name);
            }

            return (new controller(this._app))[method](req,res);
            
        });
    }
}