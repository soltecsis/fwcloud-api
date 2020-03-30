import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { RepositoryService } from "../../../../src/database/repository.service";
import { AbstractApplication } from "../../../../src/fonaments/abstract-application";
import { PolicyGroup } from "../../../../src/models/policy/PolicyGroup";
import { PolicyRule } from "../../../../src/models/policy/PolicyRule";
import { Firewall } from "../../../../src/models/firewall/Firewall";

let app: AbstractApplication;
let repositoryService: RepositoryService;

describe(describeName('PolicyRule tests'), () => {
    beforeEach(async () => {
        app = testSuite.app;

        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
    })
});