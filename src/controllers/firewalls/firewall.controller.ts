/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Controller } from '../../fonaments/http/controller';
import {
  Firewall,
  FirewallInstallCommunication,
  PluginsFlags,
} from '../../models/firewall/Firewall';
import { Request as ExpressRequest } from 'express';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { FirewallService, SSHConfig } from '../../models/firewall/firewall.service';
import { FirewallPolicy } from '../../policies/firewall.policy';
import { Channel } from '../../sockets/channels/channel';
import { ProgressPayload } from '../../sockets/messages/socket-message';
import { Validate, ValidateQuery } from '../../decorators/validate.decorator';
import { FirewallControllerCompileDto } from './dtos/compile.dto';
import { FirewallControllerInstallDto } from './dtos/install.dto';
import {
  RoutingRulesData,
  RoutingRuleService,
} from '../../models/routing/routing-rule/routing-rule.service';
import { RoutingRuleItemForCompiler } from '../../models/routing/shared';
import { RoutingCompiled, RoutingCompiler } from '../../compiler/routing/RoutingCompiler';
import { FirewallControllerCompileRoutingRuleQueryDto } from './dtos/compile-routing-rules.dto';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { PingDto } from './dtos/ping.dto';
import { InfoDto } from './dtos/info.dto';
import { Communication, FwcAgentInfo } from '../../communications/communication';
import { SSHCommunication } from '../../communications/ssh.communication';
import { AgentCommunication } from '../../communications/agent.communication';
import { PgpHelper } from '../../utils/pgp';
import { PluginDto } from './dtos/plugin.dto';
import {
  HAProxyRuleService,
  HAProxyRulesData,
} from '../../models/system/haproxy/haproxy_r/haproxy_r.service';
import { HAProxyRuleItemForCompiler } from '../../models/system/haproxy/shared';
import { HAProxyCompiled, HAProxyCompiler } from '../../compiler/system/haproxy/HAProxyCompiler';
import { DHCPRuleService, DHCPRulesData } from '../../models/system/dhcp/dhcp_r/dhcp_r.service';
import { DHCPRuleItemForCompiler } from '../../models/system/dhcp/shared';
import { DHCPCompiled, DHCPCompiler } from '../../compiler/system/dhcp/DHCPCompiler';
import {
  KeepalivedRuleService,
  KeepalivedRulesData,
} from '../../models/system/keepalived/keepalived_r/keepalived_r.service';
import {
  KeepalivedCompiled,
  KeepalivedCompiler,
} from '../../compiler/system/keepalived/KeepalivedCompiler';
import { KeepalivedRuleItemForCompiler } from '../../models/system/keepalived/shared';
import db from '../../database/database-manager';
import { OpenVPN } from '../../models/vpn/openvpn/OpenVPN';
import { PolicyRuleService } from '../../policy-rule/policy-rule.service';
import {
  Body,
  Example,
  Get,
  OperationId,
  Path,
  Post,
  Query,
  Request,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';

interface FirewallApiEnvelopeResponse<TData> {
  status: number;
  response: string;
  message: string;
  data: TData;
}

interface FirewallApiErrorEnvelopeResponse {
  status: number;
  response: string;
  message: string;
  errors?: Record<string, unknown>;
  stack?: string[];
}

interface FirewallCommunicationPingOkResponse {
  status: 'OK';
}

type FirewallRoutingCompilationResponse = RoutingCompiled;
type FirewallHAProxyCompilationResponse = HAProxyCompiled;
type FirewallDHCPCompilationResponse = DHCPCompiled;
type FirewallKeepalivedCompilationResponse = KeepalivedCompiled;

@Route('fwclouds/{fwcloud}/firewalls')
@Tags('firewall')
@Security('sessionCookie')
export class FirewallController extends Controller {
  protected firewallService: FirewallService;
  protected policyRuleService: PolicyRuleService;
  protected routingRuleService: RoutingRuleService;
  protected haproxyRuleService: HAProxyRuleService;
  protected dhcpRuleService: DHCPRuleService;
  protected keepalivedService: KeepalivedRuleService;
  protected _fwCloud: FwCloud;

  public async make(request: ExpressRequest): Promise<void> {
    //Get the fwcloud from the URL which contains the firewall
    this._fwCloud = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .createQueryBuilder('fwcloud')
      .where('fwcloud.id = :id', { id: parseInt(String(request.params.fwcloud)) })
      .getOneOrFail();

    this.firewallService = await this._app.getService<FirewallService>(FirewallService.name);
    this.policyRuleService = await this._app.getService<PolicyRuleService>(PolicyRuleService.name);
    this.routingRuleService = await this._app.getService<RoutingRuleService>(
      RoutingRuleService.name,
    );
    this.haproxyRuleService = await this._app.getService<HAProxyRuleService>(
      HAProxyRuleService.name,
    );
    this.dhcpRuleService = await this._app.getService<DHCPRuleService>(DHCPRuleService.name);
    this.keepalivedService = await this._app.getService<KeepalivedRuleService>(
      KeepalivedRuleService.name,
    );
  }

  @Validate(FirewallControllerCompileDto)
  public async compile(request: ExpressRequest): Promise<ResponseBuilder> {
    /**
     * This method is not used temporarily
     */
    const firewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: {
          id: parseInt(String(request.params.firewall)),
          fwCloudId: parseInt(String(request.params.fwcloud)),
        },
      });

    (await FirewallPolicy.compile(firewall, request.session.user)).authorize();

    const channel: Channel = await Channel.fromRequest(request);

    await this.policyRuleService.compile(firewall.fwCloudId, firewall.id, channel);

    channel.emit('message', new ProgressPayload('end', false, 'Compiling firewall'));

    return ResponseBuilder.buildResponse().status(201).body(firewall);
  }

  @Validate(FirewallControllerInstallDto)
  public async install(request: ExpressRequest): Promise<ResponseBuilder> {
    /**
     * This method is not used temporarily
     */
    let firewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: {
          id: parseInt(String(request.params.firewall)),
          fwCloudId: parseInt(String(request.params.fwcloud)),
        },
      });

    (await FirewallPolicy.install(firewall, request.session.user)).authorize();

    const channel: Channel = await Channel.fromRequest(request);

    const customSSHConfig: Partial<SSHConfig> = {
      username: request.body.sshuser ? request.body.sshuser : undefined,
      password: request.body.sshpass ? request.body.sshpass : undefined,
    };

    firewall = await this.firewallService.install(firewall, customSSHConfig, channel);

    channel.emit('message', new ProgressPayload('end', false, 'Installing firewall'));

    return ResponseBuilder.buildResponse().status(201).body(firewall);
  }

  @Validate()
  @ValidateQuery(FirewallControllerCompileRoutingRuleQueryDto)
  @OperationId('Compile firewall routing rules.')
  @Get('{firewall}/routingRules/compile')
  @SuccessResponse('200', 'Routing rules compiled')
  @Example<FirewallApiEnvelopeResponse<FirewallRoutingCompilationResponse[]>>({
    status: 200,
    response: 'OK',
    message: '',
    data: [
      {
        id: 31,
        active: true,
        comment: 'Route traffic from DMZ network through table 200',
        cs: '$IP rule add priority 1001 from 172.16.10.0/24 table 200\n',
      },
    ],
  })
  @Response<FirewallApiErrorEnvelopeResponse>('default', 'Unexpected error', {
    status: 400,
    response: 'Bad Request',
    message: 'Validation failed',
  })
  async compileRoutingRules(
    @Request() request: ExpressRequest,
    @Path() fwcloud: number,
    @Path('firewall') firewallId: number,
    @Query('rules') ruleIds?: number[],
  ): Promise<ResponseBuilder> {
    const firewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: {
          id: parseInt(String(request.params.firewall)),
          fwCloudId: parseInt(String(request.params.fwcloud)),
        },
      });

    (await FirewallPolicy.compile(firewall, request.session.user)).authorize();

    const rules: RoutingRulesData<RoutingRuleItemForCompiler>[] =
      await this.routingRuleService.getRoutingRulesData(
        'compiler',
        firewall.fwCloudId,
        firewall.id,
        request.query.rules
          ? (request.query.rules as string[]).map((item) => parseInt(item))
          : undefined,
      );
    const compilation = new RoutingCompiler().compile('Rule', rules);

    return ResponseBuilder.buildResponse().status(200).body(compilation);
  }

  @Validate()
  @ValidateQuery(FirewallControllerCompileRoutingRuleQueryDto)
  @OperationId('Compile firewall HAProxy rules.')
  @Get('{firewall}/system/haproxyRules/compile')
  @SuccessResponse('200', 'HAProxy rules compiled')
  @Example<FirewallApiEnvelopeResponse<FirewallHAProxyCompilationResponse[]>>({
    status: 200,
    response: 'OK',
    message: '',
    data: [
      {
        id: 12,
        active: true,
        cs: '# Publish HTTPS\nfrontend front_public_https\n\tmode\ttcp\n',
      },
    ],
  })
  @Response<FirewallApiErrorEnvelopeResponse>('default', 'Unexpected error', {
    status: 400,
    response: 'Bad Request',
    message: 'Validation failed',
  })
  async compileHAProxyRules(
    @Request() request: ExpressRequest,
    @Path() fwcloud: number,
    @Path('firewall') firewallId: number,
    @Query('rules') ruleIds?: number[],
  ): Promise<ResponseBuilder> {
    const firewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: {
          id: parseInt(String(request.params.firewall)),
          fwCloudId: parseInt(String(request.params.fwcloud)),
        },
      });

    (await FirewallPolicy.compile(firewall, request.session.user)).authorize();

    const rules: HAProxyRulesData<HAProxyRuleItemForCompiler>[] =
      await this.haproxyRuleService.getHAProxyRulesData(
        'compiler',
        firewall.fwCloudId,
        firewall.id,
        request.query.rules
          ? (request.query.rules as string[]).map((item) => parseInt(item))
          : undefined,
      );

    const filteredRules = rules.filter(
      (rule) => !rule.firewallApplyToId || rule.firewallApplyToId === firewall.id,
    );

    const compilation = new HAProxyCompiler().compile(filteredRules);

    return ResponseBuilder.buildResponse().status(200).body(compilation);
  }

  @Validate()
  @ValidateQuery(FirewallControllerCompileRoutingRuleQueryDto)
  @OperationId('Compile firewall DHCP rules.')
  @Get('{firewall}/system/dhcpRules/compile')
  @SuccessResponse('200', 'DHCP rules compiled')
  @Example<FirewallApiEnvelopeResponse<FirewallDHCPCompilationResponse[]>>({
    status: 200,
    response: 'OK',
    message: '',
    data: [
      {
        id: 8,
        active: true,
        cs: 'subnet 10.0.10.0 netmask 255.255.255.0 {\n\toption routers 10.0.10.1;\n}\n',
      },
    ],
  })
  @Response<FirewallApiErrorEnvelopeResponse>('default', 'Unexpected error', {
    status: 400,
    response: 'Bad Request',
    message: 'Validation failed',
  })
  async compileDHCPRules(
    @Request() request: ExpressRequest,
    @Path() fwcloud: number,
    @Path('firewall') firewallId: number,
    @Query('rules') ruleIds?: number[],
  ): Promise<ResponseBuilder> {
    const firewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: {
          id: parseInt(String(request.params.firewall)),
          fwCloudId: parseInt(String(request.params.fwcloud)),
        },
      });

    (await FirewallPolicy.compile(firewall, request.session.user)).authorize();

    const rules: DHCPRulesData<DHCPRuleItemForCompiler>[] =
      await this.dhcpRuleService.getDHCPRulesData(
        'compiler',
        firewall.fwCloudId,
        firewall.id,
        request.query.rules
          ? (request.query.rules as string[]).map((item) => parseInt(item))
          : undefined,
      );

    const compilation: DHCPCompiled[] = new DHCPCompiler().compile(rules);

    return ResponseBuilder.buildResponse().status(200).body(compilation);
  }

  @Validate()
  @ValidateQuery(FirewallControllerCompileRoutingRuleQueryDto)
  @OperationId('Compile firewall Keepalived rules.')
  @Get('{firewall}/system/keepalivedRules/compile')
  @SuccessResponse('200', 'Keepalived rules compiled')
  @Example<FirewallApiEnvelopeResponse<FirewallKeepalivedCompilationResponse[]>>({
    status: 200,
    response: 'OK',
    message: '',
    data: [
      {
        id: 21,
        active: true,
        cs: '# Keepalived rule\nvrrp_script VI_eth0 {\n\tinterface eth0\n\tstate BACKUP\n}\n',
      },
    ],
  })
  @Response<FirewallApiErrorEnvelopeResponse>('default', 'Unexpected error', {
    status: 400,
    response: 'Bad Request',
    message: 'Validation failed',
  })
  async compileKeepalivedRules(
    @Request() request: ExpressRequest,
    @Path() fwcloud: number,
    @Path('firewall') firewallId: number,
    @Query('rules') ruleIds?: number[],
  ): Promise<ResponseBuilder> {
    const firewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: {
          id: parseInt(String(request.params.firewall)),
          fwCloudId: parseInt(String(request.params.fwcloud)),
        },
      });

    (await FirewallPolicy.compile(firewall, request.session.user)).authorize();

    const rules: KeepalivedRulesData<KeepalivedRuleItemForCompiler>[] =
      await this.keepalivedService.getKeepalivedRulesData(
        'compiler',
        firewall.fwCloudId,
        firewall.id,
        request.query.rules
          ? (request.query.rules as string[]).map((item) => parseInt(item))
          : undefined,
      );
    const compilation = new KeepalivedCompiler().compile(rules);

    return ResponseBuilder.buildResponse().status(200).body(compilation);
  }

  @Validate(PingDto)
  @OperationId('Ping firewall communication.')
  @Post('communication/ping')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('200', 'Communication validated')
  @Example<FirewallApiEnvelopeResponse<FirewallCommunicationPingOkResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      status: 'OK',
    },
  })
  @Response<FirewallApiEnvelopeResponse<null>>(501, 'Method not implemented', {
    status: 501,
    response: 'Not Implemented',
    message: '',
    data: null,
  })
  @Response<FirewallApiErrorEnvelopeResponse>('default', 'Unexpected error', {
    status: 400,
    response: 'Bad Request',
    message: 'Connection failed',
  })
  async pingCommunication(
    @Request() request: ExpressRequest,
    @Body() requestBody: PingDto,
    @Path() fwcloud: number,
  ): Promise<ResponseBuilder> {
    const input: PingDto = requestBody;

    (await FirewallPolicy.ping(this._fwCloud, request.session.user)).authorize();

    const pgp = new PgpHelper(request.session.pgp);

    try {
      let communication: Communication<unknown>;

      if (input.communication === FirewallInstallCommunication.SSH) {
        communication = new SSHCommunication({
          host: input.host,
          port: input.port,
          username: await pgp.decrypt(input.username),
          password: await pgp.decrypt(input.password),
          options: null,
        });
      } else {
        communication = new AgentCommunication({
          host: input.host,
          port: input.port,
          protocol: input.protocol,
          apikey: await pgp.decrypt(input.apikey),
        });
      }

      await communication.ping();

      return ResponseBuilder.buildResponse().status(200).body({
        status: 'OK',
      });
    } catch (error) {
      if (error.message === 'Method not implemented') {
        return ResponseBuilder.buildResponse().status(501);
      }

      throw error;
    }
  }

  @Validate(InfoDto)
  @OperationId('Get firewall communication info.')
  @Post('communication/info')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('200', 'Communication info collected')
  @Example<FirewallApiEnvelopeResponse<FwcAgentInfo>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      fwc_agent_version: '2.5.0',
      host_name: 'fw-edge-01',
      system_name: 'Debian GNU/Linux',
      os_version: '12',
      kernel_version: '6.1.0-25-amd64',
    },
  })
  @Response<FirewallApiEnvelopeResponse<null>>(501, 'Method not implemented', {
    status: 501,
    response: 'Not Implemented',
    message: '',
    data: null,
  })
  @Response<FirewallApiErrorEnvelopeResponse>('default', 'Unexpected error', {
    status: 400,
    response: 'Bad Request',
    message: 'Connection failed',
  })
  async infoCommunication(
    @Request() request: ExpressRequest,
    @Body() requestBody: InfoDto,
    @Path() fwcloud: number,
  ): Promise<ResponseBuilder> {
    const input: InfoDto = requestBody;
    (await FirewallPolicy.info(this._fwCloud, request.session.user)).authorize();

    const pgp = new PgpHelper(request.session.pgp);

    try {
      let communication: Communication<unknown>;

      if (input.communication === FirewallInstallCommunication.SSH) {
        communication = new SSHCommunication({
          host: input.host,
          port: input.port,
          username: await pgp.decrypt(input.username),
          password: await pgp.decrypt(input.password),
          options: null,
        });
      } else {
        communication = new AgentCommunication({
          host: input.host,
          port: input.port,
          protocol: input.protocol,
          apikey: await pgp.decrypt(input.apikey),
        });
      }
      const info: FwcAgentInfo = await communication.info();

      return ResponseBuilder.buildResponse().status(200).body(info);
    } catch (error) {
      if (error.message === 'Method not implemented') {
        return ResponseBuilder.buildResponse().status(501);
      }

      throw error;
    }
  }

  private async getOpenVPNServerIdsInScope(
    fwcloudId: number,
    firewallId: number,
  ): Promise<number[]> {
    const firewall: Firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: {
          id: firewallId,
          fwCloudId: fwcloudId,
        },
      });

    const query = db
      .getSource()
      .manager.getRepository(OpenVPN)
      .createQueryBuilder('openvpn')
      .innerJoin('openvpn.firewall', 'firewall')
      .where('firewall.fwCloudId = :fwcloudId', { fwcloudId })
      .andWhere('openvpn.parentId IS NULL');

    if (firewall.clusterId) {
      query.andWhere('firewall.cluster = :clusterId', { clusterId: firewall.clusterId });
    } else {
      query.andWhere('firewall.id = :firewallId', { firewallId: firewall.id });
    }

    const servers: OpenVPN[] = await query.getMany();

    return servers.map((server) => server.id);
  }

  private async hasOpenVPN2FAEnabledInScope(
    fwcloudId: number,
    firewallId: number,
  ): Promise<boolean> {
    const serverIds = await this.getOpenVPNServerIdsInScope(fwcloudId, firewallId);
    if (!serverIds.length) {
      return false;
    }

    const n = await db
      .getSource()
      .manager.getRepository(OpenVPN)
      .createQueryBuilder('openvpn')
      .where('openvpn.tfaEnabled = :enabled', { enabled: 1 })
      .andWhere('(openvpn.id IN (:...serverIds) OR openvpn.parentId IN (:...serverIds))', {
        serverIds,
      })
      .getCount();

    return n > 0;
  }

  private async disableOpenVPN2FAInScope(fwcloudId: number, firewallId: number): Promise<void> {
    const serverIds = await this.getOpenVPNServerIdsInScope(fwcloudId, firewallId);
    if (!serverIds.length) {
      return;
    }

    // 1) Disable 2FA on clients of all OpenVPN servers in scope
    await db
      .getSource()
      .manager.getRepository(OpenVPN)
      .createQueryBuilder()
      .update(OpenVPN)
      .set({ tfaEnabled: 0 })
      .where('openvpn IN (:...serverIds)', { serverIds })
      .execute();

    // 2) Disable 2FA on OpenVPN servers in scope
    await db
      .getSource()
      .manager.getRepository(OpenVPN)
      .createQueryBuilder()
      .update(OpenVPN)
      .set({ tfaEnabled: 0 })
      .where('id IN (:...serverIds)', { serverIds })
      .execute();
  }

  @Validate(PluginDto)
  @OperationId('Install or uninstall firewall plugin.')
  @Post('plugin')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('200', 'Plugin action executed')
  @Example<FirewallApiEnvelopeResponse<string>>({
    status: 200,
    response: 'OK',
    message: '',
    data: '',
  })
  @Response<FirewallApiEnvelopeResponse<null>>(501, 'Method not implemented', {
    status: 501,
    response: 'Not Implemented',
    message: '',
    data: null,
  })
  @Response<FirewallApiErrorEnvelopeResponse>('default', 'Unexpected error', {
    status: 400,
    response: 'Bad Request',
    message: 'Connection failed',
  })
  async installPlugin(
    @Request() req: ExpressRequest,
    @Body() requestBody: PluginDto,
    @Path() fwcloud: number,
  ): Promise<ResponseBuilder> {
    try {
      const channel = await Channel.fromRequest(req);
      const pgp = new PgpHelper(req.session.pgp);
      const communication = new AgentCommunication({
        protocol: requestBody.protocol,
        host: requestBody.host,
        port: requestBody.port,
        apikey: await pgp.decrypt(requestBody.apikey),
      });

      if (
        requestBody.plugin === PluginsFlags.openvpn &&
        !requestBody.enable &&
        requestBody.firewallId
      ) {
        const fwcloudId = parseInt(String(req.params.fwcloud));
        const firewallId = parseInt(String(requestBody.firewallId));

        const has2FAEnabled = await this.hasOpenVPN2FAEnabledInScope(fwcloudId, firewallId);
        if (has2FAEnabled) {
          await this.disableOpenVPN2FAInScope(fwcloudId, firewallId);

          // 3) Uninstall OpenVPN 2FA plugin before uninstalling OpenVPN plugin
          await communication.installPlugin('openvpn-2fa', false, channel);
        }
      }

      const data = await communication.installPlugin(
        requestBody.plugin,
        requestBody.enable,
        channel,
      );

      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      if (error.message === 'Method not implemented') {
        return ResponseBuilder.buildResponse().status(501);
      }
      throw error;
    }
  }
}
