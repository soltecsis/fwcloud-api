import { Application } from "../../../../../src/Application";
import { runApplication } from "../../../../utils/utils";
import { RouterService } from "../../../../../src/fonaments/http/router/RouterService"

let app: Application;

beforeAll( async () => {
    const app = runApplication(false);
});
describe('Request tests', () => { });