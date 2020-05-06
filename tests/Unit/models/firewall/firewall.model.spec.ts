import { describeName, expect, testSuite } from "../../../mocha/global-setup";
import { getRepository } from "typeorm";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import StringHelper from "../../../../src/utils/string.helper";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import * as path from "path";

describe(describeName('Firewall Model Unit Tests'), () => {
    describe('getPolicyPath()', () => {
        let fwCloud: FwCloud;
        let policyPath: string;
        let policyFilename: string;

        beforeEach(async() => {
            fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
                name: StringHelper.randomize(10)
            }));

            policyPath = testSuite.app.config.get('policy').data_dir;
            policyFilename = testSuite.app.config.get('policy').script_name;
        });

        it('should return a path if the firewall belongs to a fwcloud and it has an id', async () => {
            const firewall: Firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
                name: StringHelper.randomize(10),
                fwCloudId: fwCloud.id
            }));

            expect(firewall.getPolicyFilePath()).to.be.deep.eq(
                path.join(policyPath, firewall.fwCloudId.toString(), firewall.id.toString(), policyFilename));
        });

        it('should return null if the firewall does not belong to a fwcloud', async() => {
            const firewall: Firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
                name: StringHelper.randomize(10)
            }));

            expect(firewall.getPolicyFilePath()).to.be.null;
        });

        it('should return null if the firewall does not persisted', async() => {
            const firewall: Firewall = getRepository(Firewall).create({
                name: StringHelper.randomize(10),
                fwCloudId: fwCloud.id
            });

            expect(firewall.getPolicyFilePath()).to.be.null;
        });
    });
});