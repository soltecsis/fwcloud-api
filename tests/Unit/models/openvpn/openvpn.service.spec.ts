import { describeName, testSuite, expect } from "../../../mocha/global-setup";
import { Application } from "../../../../src/Application";
import { FirewallService } from "../../../../src/models/firewall/firewall.service";
import { OpenVPNService } from "../../../../src/models/vpn/openvpn/openvpn.service";

describe(describeName('OpenVPN Service Unit Tests'), () => {
    let app: Application;
    let service: OpenVPNService;
    
    beforeEach(async () => {
        app = testSuite.app;
        service = await app.getService<OpenVPNService>(OpenVPNService.name);
    });

    it('should be provided as an application service', async () => {
        expect(await app.getService<OpenVPNService>(OpenVPNService.name)).to.be.instanceOf(OpenVPNService);
    });
    
});