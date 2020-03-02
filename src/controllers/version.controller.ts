import { Controller } from "../fonaments/http/controller";
import { Request, Response } from "express";
import { app } from "../fonaments/abstract-application";
import { Application } from "../Application";
import { Version } from "../version/version";
import { ResponseBuilder } from "../fonaments/http/response-builder";

export class VersionController extends Controller {
    public async show(request: Request): Promise<ResponseBuilder> {
        const version: Version = app<Application>().getVersion()
        
        return ResponseBuilder.buildResponse().status(200).body(version);
    }
}