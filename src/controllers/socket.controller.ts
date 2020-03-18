import { Controller } from "../fonaments/http/controller";
import { Request } from "express";
import { ResponseBuilder } from "../fonaments/http/response-builder";

export class SocketController extends Controller {
    public async attach(request: Request): Promise<ResponseBuilder> {
        request.session.socket_id = request.body.socket_id;

        return ResponseBuilder.buildResponse().status(201);
    }
}