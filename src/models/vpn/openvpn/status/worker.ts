import { getRepository } from "typeorm";
import { Application } from "../../../../Application";
import { AgentCommunication } from "../../../../communications/agent.communication";
import { OpenVPNHistoryRecord } from "../../../../communications/communication";
import db from "../../../../database/database-manager";
import { Firewall, FirewallInstallCommunication } from "../../../firewall/Firewall";
import { OpenVPN } from "../OpenVPN";
import { OpenVPNOption } from "../openvpn-option.model";
import { CreateOpenVPNStatusHistoryData, OpenVPNStatusHistoryService } from "./openvpn-status-history.service";

async function iterate(application: Application): Promise<void> {
    try {
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
            try {
                const firewalls: Firewall[] = openvpn.firewall.clusterId
                    ? await getRepository(Firewall).createQueryBuilder('firewall')
                        .where('firewall.clusterId = :cluster', {cluster: openvpn.firewall.clusterId})
                        .andWhere('firewall.install_communication = :communication', {
                            communication: FirewallInstallCommunication.Agent
                        })
                        .getMany()
                    : [openvpn.firewall];

                let entries: CreateOpenVPNStatusHistoryData[] = [];
                for(let firewall of firewalls) {
                    const communication: AgentCommunication = await firewall.getCommunication() as AgentCommunication;

                    const statusOption: OpenVPNOption = await OpenVPN.getOptData(db.getQuery(), openvpn.id, 'status') as OpenVPNOption;

                    if (statusOption) {

                        const data: OpenVPNHistoryRecord[] = await communication.getOpenVPNHistoryFile(statusOption.arg);

                        entries = entries.concat(data.map(item => ({
                            timestampInSeconds: item.timestamp,
                            name: item.name,
                            address: item.address,
                            bytesReceived: item.bytesReceived,
                            bytesSent: item.bytesSent,
                            connectedAtTimestampInSeconds: item.connectedAtTimestampInSeconds
                        })));
                    }
                }

                await service.create(openvpn.id, entries);
            } catch(error) {
                application.logger().error(`WorkerError: Opevpn ${openvpn.id} failed: ${error.message}`);
            }
        }
    } catch(error) {
        application.logger().error(`WorkerError: ${error.message}`);
    }
}

async function waitUntilNextIteration(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {

        if (ms <= 0) {
            return resolve();
        }

        setTimeout(() => {
            return resolve();
        }, ms);
    })
}

async function work(): Promise<void> {
    const application = await Application.run();
    const interval: number = application.config.get('openvpn.agent.history.interval');

    application.logger().info(`Openvpn history worker started (collection interval:  ${interval} minutes).`)

    while(true) {
        const t1: number = Date.now();

        await iterate(application);

        const msUntilConsumeInterval: number = (interval * 60 * 1000) - (Date.now() - t1);
        await waitUntilNextIteration(msUntilConsumeInterval);
    }
}

work().then(() => {}).catch(error => {
    console.error(error);
    throw error;
})