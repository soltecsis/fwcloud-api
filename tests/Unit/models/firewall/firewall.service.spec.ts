import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { Application } from "../../../../src/Application";
import { FirewallService } from "../../../../src/models/firewall/firewall.service";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import { RepositoryService } from "../../../../src/database/repository.service";
import { Repository, getRepository } from "typeorm";
import StringHelper from "../../../../src/utils/string.helper";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { FSHelper } from "../../../../src/utils/fs-helper";
import * as path from "path";
import * as fs from "fs";

describe(describeName('Firewall Service Unit Tests'), () => {
    let app: Application;
    let service: FirewallService;
    let firewall: Firewall;
    let firewallRepository: Repository<Firewall>;

    beforeEach(async() => {
        app = testSuite.app;
        service = await app.getService<FirewallService>(FirewallService.name);
        firewallRepository = (await app.getService<RepositoryService>(RepositoryService.name)).for(Firewall);

        firewall = await firewallRepository.save(firewallRepository.create({
            name: StringHelper.randomize(10),
            fwCloudId: (await getRepository(FwCloud).save(getRepository(FwCloud).create({name: StringHelper.randomize(10)}))).id
        }));
    });

    it('should be provided as an application service', async () => {
        expect(await app.getService<FirewallService>(FirewallService.name)).to.be.instanceOf(FirewallService);
    });

    describe('compile()', () => {

        it('should throw an exception if the firewall does not belong to a fwcloud', async () => {
            const _f: Firewall = await firewallRepository.save(firewallRepository.create({name: StringHelper.randomize(10)}));

            function t() {
                service.compile(_f);
            }

            expect(t).to.throw(Error);
        });

        it('should create the firewall policy directory', (done) => {
            service.compile(firewall).on('end', async (message: object) => {
                try {
                    const directoryExists: boolean = FSHelper.directoryExistsSync(path.join(app.config.get('policy').data_dir, firewall.fwCloudId.toString(), firewall.id.toString()));
                    expect(directoryExists).to.be.true;
                    done();
                } catch(e) {
                    done(e);
                }
            });
        });

        it('should remove the policy directory if it already exists', (done) => {
            const testFilePath: string = path.join(app.config.get('policy').data_dir, firewall.fwCloudId.toString(), firewall.id.toString(), 'test');
            FSHelper.mkdirSync(path.dirname(testFilePath));
            fs.writeFileSync(testFilePath, "");

            service.compile(firewall).on('end', async (message: object) => {
                try {
                    expect(FSHelper.fileExistsSync(testFilePath)).to.be.false;
                    done();
                } catch(e) {
                    done(e);
                }
            });
        });

        it('should create script file', (done) => {
            const scriptPath: string = path.join(app.config.get('policy').data_dir, firewall.fwCloudId.toString(), firewall.id.toString(), app.config.get('policy').script_name);
            
            service.compile(firewall).on('end', async (message: object) => {
                try {
                    expect(FSHelper.fileExistsSync(scriptPath)).to.be.true;
                    done();
                } catch(e) {
                    done(e);
                }
            });
        });

        it('should append headers into the script file', (done) => {
            const scriptPath: string = path.join(app.config.get('policy').data_dir, firewall.fwCloudId.toString(), firewall.id.toString(), app.config.get('policy').script_name);
            
            service.compile(firewall).on('end', async (message: object) => {
                try {
                    const scriptData: string = fs.readFileSync(scriptPath).toString();
                    const headers: string = fs.readFileSync(app.config.get('policy').header_file).toString();
                    expect(scriptData).contain(headers);
                    done();
                } catch(e) {
                    done(e);
                }
            });
        });

        it('should append footer into the script file', (done) => {
            const scriptPath: string = path.join(app.config.get('policy').data_dir, firewall.fwCloudId.toString(), firewall.id.toString(), app.config.get('policy').script_name);
            
            service.compile(firewall).on('end', async (message: object) => {
                try {
                    const scriptData: string = fs.readFileSync(scriptPath).toString();
                    const footers: string = fs.readFileSync(app.config.get('policy').footer_file).toString();
                    expect(scriptData).contain(footers);
                    done();
                } catch(e) {
                    done(e);
                }
            });
        });
    });
});