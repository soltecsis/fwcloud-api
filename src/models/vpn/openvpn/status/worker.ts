import { getRepository } from "typeorm";
import { Application } from "../../../../Application";
import { FirewallInstallCommunication } from "../../../firewall/Firewall";
import { OpenVPN } from "../OpenVPN";

async function iterate(application: Application): Promise<void> {
    const openvpns: OpenVPN[] = await getRepository(OpenVPN).createQueryBuilder('openvpn')
        .innerJoin('openvpn.crt', 'crt')
        .innerJoinAndSelect('openvpn.firewall', 'firewall')
        .where('openvpn.parentId IS NULL')
        .andWhere('crt.type =  2')
        .andWhere('firewall.install_communication = :communication', {
            communication: FirewallInstallCommunication.Agent
        }).getMany();
}

async function work(): Promise<void> {
    const application = await Application.run();

    await iterate(application);
    setInterval(async () => {
        await iterate(application);
    }, 1 * 60 * 1000);
}

work().then(() => {}).catch(error => {
    console.error(error);
    throw error;
})