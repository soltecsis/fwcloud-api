import { Policy, Authorization } from "../fonaments/authorization/policy";
import { Firewall } from "../models/firewall/Firewall";
import { User } from "../models/user/User";
import { getRepository } from "typeorm";
import { OpenVPN } from "../models/vpn/openvpn/OpenVPN";

export class OpenVPNPolicy extends Policy {

    static async installer(openvpn: OpenVPN, user: User): Promise<Authorization> {
        user = await getRepository(User).findOneOrFail(user.id, {relations: ['fwClouds']});
        openvpn = await getRepository(OpenVPN).findOneOrFail(openvpn.id, {relations: ['firewall']});

        if (user.role === 1) {
            return Authorization.grant();
        }

        if (openvpn.firewall) {
            const firewall: Firewall = await getRepository(Firewall).findOneOrFail(openvpn.firewall, {relations: ['fwCloud']})
            
            const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === firewall.fwCloudId});

            return match.length > 0 ? Authorization.grant() : Authorization.revoke();
        }

        return Authorization.revoke();
    }
}