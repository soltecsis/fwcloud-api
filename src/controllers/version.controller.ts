import { Controller } from "../fonaments/http/controller";
import { Request, Response } from "express";
import { app } from "../fonaments/abstract-application";
import { Application } from "../Application";
import { Version } from "../version/version";
import { ResponseBuilder } from "../fonaments/http/response-builder";

export class VersionController extends Controller {
    public show(request: Request, response: Response): any {
        const version: Version = app<Application>().getVersion()
        
        ResponseBuilder.make(response).status(200).send(version);
    }
}