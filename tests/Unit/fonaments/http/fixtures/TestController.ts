import { Controller } from "../../../../../src/fonaments/http/Controller";
import { Request } from "express";

export class TestController extends Controller {

    public show(req: Request, res: Response) {
        console.log('test!');
    }
}