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

import { Request } from 'express';
import { HttpException } from '../fonaments/exceptions/http/http-exception';
import { IptablesSaveToFWCloud } from './iptables-save.model';
import { NetFilterTables, IptablesSaveStats } from './iptables-save.data';
import {
  Firewall,
  FirewallInstallCommunication,
} from '../models/firewall/Firewall';
import { Channel } from '../sockets/channels/channel';
import { ProgressNoticePayload } from '../sockets/messages/socket-message';
import { PolicyRule } from '../models/policy/PolicyRule';
import { SSHCommunication } from '../communications/ssh.communication';
import { Communication } from '../communications/communication';
import { AgentCommunication } from '../communications/agent.communication';
import { PgpHelper } from '../utils/pgp';
import { IPObj } from '../models/ipobj/IPObj';
import db from '../database/database-manager';
var utilsModel = require('../utils/utils.js');

export class IptablesSaveService extends IptablesSaveToFWCloud {
  public async import(request: Request): Promise<IptablesSaveStats> {
    this.req = request;
    this.data = request.body.data;
    this.table = null;
    this.stats = { rules: 0, interfaces: 0, ipObjs: 0, modulesIgnored: [] }; // Reset statistics.

    const fwOptions: any = await Firewall.getFirewallOptions(
      this.req.body.fwcloud,
      this.req.body.firewall,
    );
    this.statefulFirewall = parseInt(fwOptions) & 0x1 ? true : false;

    const channel = await Channel.fromRequest(request);

    // Clean current firewall policy
    await PolicyRule.deletePolicy_r_Firewall(this.req.body.firewall); //DELETE POLICY, Objects in Positions and firewall rule groups.
    // Create default policy. The second parameter is the lo interface id. If we pass it as null the default rules
    // for the lo interface and useful icmp types will not be created.
    await PolicyRule.insertDefaultPolicy(
      this.req.body.firewall,
      null,
      fwOptions,
    );

    for (this.line = 0; this.line < this.data.length; this.line++) {
      channel.emit(
        'message',
        new ProgressNoticePayload(`${this.line + 1}/${this.data.length}`),
      );

      // Get items of current string.
      this.items = this.data[this.line].trim().split(/\s+/);

      // Ignore comments or empty lines.
      if (
        this.items[0] === '#' ||
        this.items.length === 0 ||
        this.items[0] === ''
      )
        continue;

      // Iptables table with which we are working now.
      if (!this.table) {
        if (!NetFilterTables.has(this.items[0].substr(1)))
          throw new HttpException(
            `Bad iptables-save data (line: ${this.line + 1})`,
            400,
          );
        this.table = this.items[0].substr(1);
        this.chain = null;
        this.customChainsMap = new Map();
        this.ruleGroupId = 0;
        this.ruleGroupName = null;
        this.previousRuleId = null;
        continue;
      }

      // End of iptables table.
      if (this.items[0] === 'COMMIT') {
        this.table = null;
        continue;
      }

      // By the moment ignore MANGLE and RAW iptables tables.
      if (this.table === 'mangle' || this.table === 'raw') continue;

      try {
        if (this.data[this.line].charAt(0) === ':')
          await this.generateCustomChainsMap();
        else if (this.items[0] === '-A') {
          // Generate rule.
          if (await this.generateRule()) {
            await this.fillRulePositions(this.line);

            // If it is possible, merge this rule with the previous one.
            await this.mergeWithPreviousRule();

            // Once we have created the fwcloud rule, search for groups that can group items in a position.
            await this.groupRulePositionItems();
          }
        }
      } catch (err) {
        throw new HttpException(
          `ERROR in iptables-save import (line: ${this.line + 1})${err.message ? ': ' + err.message : ''} `,
          400,
        );
      }
    }

    return this.stats;
  }

  public async importThroughCommunication(
    request: Request,
  ): Promise<IptablesSaveStats> {
    let communication: Communication<unknown>;

    if (request.body.communication === FirewallInstallCommunication.SSH) {
      communication = new SSHCommunication({
        host: request.body.ip,
        port: request.body.port,
        username: request.body.sshuser,
        password: request.body.sshpass,
        options: null,
      });
    } else {
      communication = new AgentCommunication({
        host: request.body.ip,
        port: request.body.port,
        protocol: request.body.protocol,
        apikey: request.body.apikey,
      });
    }

    try {
      request.body.data = await communication.getFirewallIptablesSave();
    } catch (err) {
      if (err.fwcErr == 9000) {
        throw new HttpException(err.msg, 400);
      }
      throw new HttpException(`${err.message} `, 401);
    }

    await this.import(request);
    return this.stats;
  }

  public async export(request: Request): Promise<string[]> {
    let result: any;

    try {
      const firewall: Firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .createQueryBuilder('firewall')
        .where('firewall.id = :id', { id: request.body.firewall })
        .andWhere('firewall.fwCloudId = :fwcloud', {
          fwcloud: request.body.fwcloud,
        })
        .getOneOrFail();
      let communication: Communication<unknown>;

      if (firewall.install_communication === FirewallInstallCommunication.SSH) {
        communication = new SSHCommunication({
          host: Object.prototype.hasOwnProperty.call(request.body, 'host')
            ? request.body.host
            : (
                await db
                  .getSource()
                  .manager.getRepository(IPObj)
                  .findOneOrFail({ where: { id: firewall.install_ipobj } })
              ).address,
          port: Object.prototype.hasOwnProperty.call(request.body, 'port')
            ? request.body.port
            : firewall.install_port,
          username: Object.prototype.hasOwnProperty.call(
            request.body,
            'sshuser',
          )
            ? request.body.sshuser
            : utilsModel.decrypt(firewall.install_user),
          password: Object.prototype.hasOwnProperty.call(
            request.body,
            'sshpass',
          )
            ? request.body.sshpass
            : utilsModel.decrypt(firewall.install_pass),
          options: null,
        });
      } else {
        communication = await firewall.getCommunication();
      }

      result = await communication.getFirewallIptablesSave();
    } catch (err) {
      if (err.fwcErr == 9000) {
        throw new HttpException(err.msg, 400);
      }
      throw new HttpException(`${err.message} `, 401);
    }

    return result;
  }
}
