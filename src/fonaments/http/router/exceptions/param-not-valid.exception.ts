import { Route } from "../route";

export class ParamNotValidException extends Error {
    constructor(paramName: string, paramValue: string, route: Route) {
        let message: string = `Param :${paramName} with value="${paramValue}" is not a valid parameter when generating URL for route "${route.pathParams}"`;

        super(message);
    }
}