import { getRepository } from "typeorm";
import { Application } from "../../../../Application";
import { AgentCommunication } from "../../../../communications/agent.communication";
import { OpenVPNHistoryRecord } from "../../../../communications/communication";
import { FirewallInstallCommunication } from "../../../firewall/Firewall";
import { OpenVPN } from "../OpenVPN";
import { OpenVPNStatusHistoryService } from "./openvpn-status-history.service";

async function iterate(application: Application): Promise<void> {
    const service: OpenVPNStatusHistoryService = await application.getService(OpenVPNStatusHistoryService.name);

    const openvpns: OpenVPN[] = await getRepository(OpenVPN).createQueryBuilder('openvpn')
        .innerJoin('openvpn.crt', 'crt')
        .innerJoinAndSelect('openvpn.firewall', 'firewall')
        .where('openvpn.parentId IS NULL')
        .andWhere('crt.type =  2')
        .andWhere('firewall.install_communication = :communication', {
            communication: FirewallInstallCommunication.Agent
        }).getMany();

        for(let openvpn of openvpns) {
            const communication: AgentCommunication = await openvpn.firewall.getCommunication() as AgentCommunication;

            const data: OpenVPNHistoryRecord[] = [];

            for(let record of data) {
                await service.create({
                    timestamp: record.timestamp,
                    name: record.name,
                    address: record.name,
                    bytesReceived: record.bytesReceived,
                    bytesSent: record.bytesSent,
                    connectedAt: record.connected_at,
                    openVPNServerId: openvpn.id
                })
            }
        }
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