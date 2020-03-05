import { Route } from "../route";

export class ParamMissingException extends Error {
    constructor(params: Array<string>, route: Route) {
        const message: string = `Params ${params} missing when generating URL for ${route.pathParams}`;

        super(message);
    }
}