import { FSHelper } from './../../../../src/utils/fs-helper';
import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { OpenVPNService } from "../../../../src/models/vpn/openvpn/openvpn.service";
import * as fs from "fs";
import { FwCloudFactory, FwCloudProduct } from "../../../utils/fwcloud-factory";
import path from "path";
import { CreateOpenVPNStatusHistoryData, OpenVPNStatusHistoryService } from "../../../../src/models/vpn/openvpn/status/openvpn-status-history.service";
import { AbstractApplication } from '../../../../src/fonaments/abstract-application';
import sinon from 'sinon';

describe(describeName('OpenVPN Service Unit Tests'), () => {

    let app: AbstractApplication;
    let openVPNService: OpenVPNService;
    let openVPNStatusHistoryService : OpenVPNStatusHistoryService
    let fwcProduct : FwCloudProduct;
    let data: CreateOpenVPNStatusHistoryData[];
    let newData: CreateOpenVPNStatusHistoryData[];
    let yearDir: string;
    let monthSubDir: string;
    let fileName: string;
    let filePath: string;
    
    beforeEach(async () => {
        app = testSuite.app;
        await testSuite.resetDatabaseData();
        fwcProduct = await (new FwCloudFactory()).make();
        openVPNService = await (await app.getService<OpenVPNService>(OpenVPNService.name));
        openVPNStatusHistoryService = await (await app.getService<OpenVPNStatusHistoryService>(OpenVPNStatusHistoryService.name));
        
        data = [{
            timestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
            name: 'test-status-history1',
            address: '1.1.1.1',
            bytesReceived: 100,
            bytesSent: 200,
            connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0))
            },
            {
            timestampInSeconds: parseInt((new Date('2000-01-01').getTime() /1000).toFixed(0)),
            name: 'test-status-history2',
            address: '1.1.1.1',
            bytesReceived: 100,
            bytesSent: 200,
            connectedAtTimestampInSeconds: parseInt((new Date('2000-01-01').getTime() /1000).toFixed(0))
            }
        ];

        await openVPNStatusHistoryService.create(fwcProduct.openvpnServer.id, data)

        await openVPNService.archiveHistory()

        const date = new Date() 
        yearDir = (date.getFullYear()).toString();
        monthSubDir = (("0" + (date.getMonth() + 1)).slice(-2));
        fileName = `openvpn_status_history-${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${("0" + date.getDate()).slice(-2)}.sql`;
        filePath = path.join(`${path.join(app.config.get('openvpn.history').data_dir, yearDir, monthSubDir, fileName)}.zip` ) 
        
    });

    it('should be provided as an application service', async () => {
        expect(await app.getService<OpenVPNService>(OpenVPNService.name)).to.be.instanceOf(OpenVPNService);
    });


    describe('archiveHistory()', () =>{

        it('should create a backup directory', async () => {

            const directory = path.join(`${path.join(app.config.get('openvpn.history').data_dir, yearDir, monthSubDir)}` ) 

            expect(FSHelper.directoryExistsSync(directory)).to.be.true;
        });
        
        it('should be created a zip file with data records file less than archive_days config', async() => {
            
            expect(fs.existsSync(filePath)).to.be.true;
        })
        it('should remove a unzipped data records file', async () => {
            
            expect(fs.existsSync(path.join(app.config.get('openvpn.history').data_dir, yearDir, monthSubDir, fileName))).to.be.false;
        });

        it('should be deleted zipped records', async() => {
            
            const results = await openVPNStatusHistoryService.history(fwcProduct.openvpnServer.id, {
                name: data[1].name
            });

            expect(results).to.not.have.property("name");
        })
        it('should be added new records to zip file if exist new registers', async() => {
            
            const date = new Date();
            const oldDate = date.setMonth(date.getMonth() - 4);
            
            newData = [{
                timestampInSeconds: parseInt((new Date(oldDate).getTime() /1000).toFixed(0)),
                name: 'test-status-history3',
                address: '1.1.1.1',
                bytesReceived: 100,
                bytesSent: 200,
                connectedAtTimestampInSeconds: parseInt((new Date(oldDate).getTime() / 1000).toFixed(0))
                },
            ];
            await openVPNStatusHistoryService.create(fwcProduct.openvpnServer.id, newData)
            
            await openVPNService.archiveHistory();
            const results = await openVPNStatusHistoryService.history(fwcProduct.openvpnServer.id, {
                name: newData[0].name
            });
            
            expect(results).to.not.have.property("name");
        })

    });

    describe('removeExpiredFiles()', () => {
        let clock;
        before(async () => { 
            const date = new Date();
            const futureDate = date.setFullYear(date.getFullYear() + 4);
            //Mock the clock timer to test because the method removeExpiredFiles() checks the birthTime of the files
            clock = sinon.useFakeTimers({
                now: new Date(futureDate),
                shouldAdvanceTime: true,
                toFake: ["Date"],
            });
        })

        after(async () => {
            clock.restore();
        })   
        
        it('should be deleted files with date of creation greater than retention_days config', async () => {
            const res = await openVPNService.removeExpiredFiles()
            expect(fs.existsSync(filePath)).to.be.false;
            expect(res).to.be.equal(1)            
        })
    }); 

    describe('updateArchiveConfig()', () => {

        it('custom config should be stored in json file', async () => {
            const jsonPath = path.join(app.config.get('openvpn.history').data_dir, 'config.json');
            let custom_config = {history:{archive_days: 20, retention_days: 40}};
            await openVPNService.updateArchiveConfig(custom_config);

            expect(fs.existsSync(jsonPath)).to.be.true;
        })

        it('base config should be overwritten by a custom config', async () => {
            let custom_config = {history:{archive_days: 20, retention_days: 40}};
            await openVPNService.updateArchiveConfig(custom_config);
            const config = await openVPNService.getCustomizedConfig();

            expect(config).to.be.deep.equal(custom_config);

        });
    });
});