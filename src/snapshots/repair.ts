/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Repair } from "../models/tree/Repair";
import { OpenVPN } from "../models/vpn/openvpn/OpenVPN";
import { FwCloud } from "../models/fwcloud/FwCloud";
import db from "../database/database-manager";
import { OpenVPNPrefix } from "../models/vpn/openvpn/OpenVPNPrefix";
import { Tree } from "../models/tree/Tree";

export class SnapshotRepair {
    public static async repair(fwCloud: FwCloud) {
        const rootNodes: Array<any> = <Array<any>>await Repair.checkRootNodes(db.getQuery());

        await Repair.checkNotRootNodes(rootNodes);

        for (let rootNode of rootNodes) {
            if (rootNode.node_type === 'FDF') { // Firewalls and clusters tree.
                await Repair.checkFirewallsFoldersContent(rootNode);
                await Repair.checkFirewallsInTree(rootNode);
                await Repair.checkClustersInTree(rootNode);
                const openvpn_srv_list: Array<any> = <Array<any>>await OpenVPN.getOpenvpnServersByCloud(db.getQuery(), fwCloud.id);
                for (let openvpn_srv of openvpn_srv_list) {
                    await OpenVPNPrefix.applyOpenVPNPrefixes(db.getQuery(), fwCloud.id, openvpn_srv.id);
                }
                break;
            }
            else if (rootNode.node_type === 'FDO') { // Objects tree.
                // Remove the full tree an create it again from scratch.
                await Tree.deleteFwc_TreeFullNode({ id: rootNode.id, fwcloud: fwCloud.id });
                const ids: {
                    Addresses: any,
                    AddressesRanges: any,
                    Networks: any,
                    DNS: any,
                    OBJECTS: any,
                    Marks: any,
                    Groups: any,
                } = <any>await Tree.createObjectsTree(db.getQuery(), fwCloud.id);

                await Repair.checkNonStdIPObj(ids.Addresses, 'OIA', 5);

                await Repair.checkNonStdIPObj(ids.AddressesRanges, 'OIR', 6);

                await Repair.checkNonStdIPObj(ids.Networks, 'OIN', 7);

                await Repair.checkNonStdIPObj(ids.DNS, 'ONS', 9);

                rootNode.id = ids.OBJECTS;
                await Repair.checkHostObjects(rootNode);

                await Repair.checkNonStdIPObj(ids.Marks, 'MRK', 30);

                await Repair.checkNonStdIPObjGroup(ids.Groups, 'OIG', 20);
                break;
            }
            else if (rootNode.node_type === 'FDS') { // Services tree.
                // Remove the full tree an create it again from scratch.
                await Tree.deleteFwc_TreeFullNode({ id: rootNode.id, fwcloud: fwCloud.id });
                const ids: {
                    IP: any,
                    ICMP: any,
                    TCP: any,
                    UDP: any,
                    Groups: any
                } = <any>await Tree.createServicesTree(db.getQuery(), fwCloud.id);

                await Repair.checkNonStdIPObj(ids.IP, 'SOI', 1);

                await Repair.checkNonStdIPObj(ids.ICMP, 'SOM', 3);

                await Repair.checkNonStdIPObj(ids.TCP, 'SOT', 2);

                await Repair.checkNonStdIPObj(ids.UDP, 'SOU', 4);

                await Repair.checkNonStdIPObjGroup(ids.Groups, 'SOG', 21);
                break;
            }
        }
    }
}