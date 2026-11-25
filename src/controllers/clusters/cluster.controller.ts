import { Request as ExpressRequest } from 'express';
import {
  Body,
  Example,
  OperationId,
  Path,
  Post,
  Request,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { Validate } from '../../decorators/validate.decorator';
import { ClusterPolicyInstallDto } from '../firewalls/dtos/cluster-policy-install.dto';
import { Cluster } from '../../models/firewall/Cluster';
import { Firewall, FirewallInstallCommunication } from '../../models/firewall/Firewall';
import { FirewallPolicy } from '../../policies/firewall.policy';
import {
  ClusterPolicyResult,
  installClusterPolicy,
} from '../../communications/cluster-policy-installer';
import { Channel } from '../../sockets/channels/channel';
import { ProgressPayload } from '../../sockets/messages/socket-message';
import { PgpHelper } from '../../utils/pgp';
import db from '../../database/database-manager';

const firewallUtils = require('../../utils/utils');

interface ClusterApiEnvelopeResponse<TData> {
  status: number;
  response: string;
  message: string;
  data: TData;
}

@Route('fwclouds/{fwcloud}/clusters')
@Tags('cluster')
@Security('sessionCookie')
export class ClusterController extends Controller {
  @Validate(ClusterPolicyInstallDto)
  @OperationId('Install cluster firewall policy')
  @Post('{cluster}/policy/install')
  @SuccessResponse('200', 'Cluster policy installation completed')
  @Example<ClusterApiEnvelopeResponse<ClusterPolicyResult>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      success: false,
      nodes: [
        { firewallId: 1, installation: 'installed', recovery: 'restored' },
        { firewallId: 2, installation: 'failed', recovery: 'restored' },
        { firewallId: 3, installation: 'pending', recovery: 'not_needed' },
      ],
    },
  })
  async installClusterPolicy(
    @Request() request: ExpressRequest,
    @Body() requestBody: ClusterPolicyInstallDto,
    @Path() fwcloud: number,
    @Path() cluster: number,
  ): Promise<ResponseBuilder> {
    const input = this.getBody(request, requestBody);
    const cloudId = Number(request.params.fwcloud);
    const clusterId = Number(request.params.cluster);
    if (
      !/^\d+$/.test(String(request.params.cluster)) ||
      !Number.isSafeInteger(clusterId) ||
      clusterId < 1
    ) {
      throw new HttpException('Invalid cluster identifier', 400);
    }
    await db
      .getSource()
      .manager.getRepository(Cluster)
      .findOneOrFail({
        where: { id: clusterId, fwCloudId: cloudId },
      });
    const firewalls = await db
      .getSource()
      .manager.getRepository(Firewall)
      .find({
        where: { fwCloudId: cloudId, clusterId },
      });
    const requestedIds = input.nodes.map((node) => node.firewallId);
    if (
      !firewalls.length ||
      requestedIds.length !== firewalls.length ||
      new Set(requestedIds).size !== firewalls.length ||
      firewalls.some((firewall) => !requestedIds.includes(firewall.id))
    ) {
      throw new HttpException('All cluster nodes must be provided exactly once', 400);
    }
    const masterNodes = firewalls.filter((firewall) => firewall.fwmaster === 1);
    if (masterNodes.length !== 1) throw new HttpException('Cluster must have one master node', 400);
    for (const firewall of firewalls) {
      (await FirewallPolicy.install(firewall, request.session.user)).authorize();
    }
    const pgp = new PgpHelper(request.session.pgp);
    const nodes = [];
    for (const entry of input.nodes) {
      const firewall = firewalls.find((item) => item.id === entry.firewallId);
      if (firewall.install_communication === FirewallInstallCommunication.SSH) {
        if (!entry.sshuser || !entry.sshpass)
          throw new HttpException('SSH credentials are required for every SSH node', 400);
        const sshuser = await pgp.decrypt(entry.sshuser);
        const sshpassword = await pgp.decrypt(entry.sshpass);
        if (!sshuser || !sshpassword)
          throw new HttpException('SSH credentials are required for every SSH node', 400);
        nodes.push({
          firewallId: firewall.id,
          communication: await firewall.getCommunication({ sshuser, sshpassword }),
        });
      } else if (firewall.install_communication === FirewallInstallCommunication.Agent) {
        if (!firewall.install_apikey || !firewallUtils.decrypt(firewall.install_apikey))
          throw new HttpException('An API key is required for every agent node', 400);
        nodes.push({ firewallId: firewall.id, communication: await firewall.getCommunication() });
      } else {
        throw new HttpException('Unsupported firewall communication method', 400);
      }
    }
    const channel = await Channel.fromRequest(request);
    const result = await installClusterPolicy(nodes, masterNodes[0].getPolicyFilePath(), channel);
    if (result.success) {
      for (const node of nodes) {
        await Firewall.updateFirewallStatus(cloudId, node.firewallId, '&~2');
        await Firewall.updateFirewallInstallDate(cloudId, node.firewallId);
      }
    }
    channel.emit('message', new ProgressPayload('end', false, 'Cluster installation completed'));
    return ResponseBuilder.buildResponse().status(200).body(result);
  }
}
