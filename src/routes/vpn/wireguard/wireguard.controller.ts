import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { Validate } from '../../../decorators/validate.decorator';
import { WireGuard } from '../../../models/vpn/wireguard/WireGuard';
import { Tree } from '../../../models/tree/Tree';
import { IPObj } from '../../../models/ipobj/IPObj';
import { WireGuardPrefix } from '../../../models/vpn/wireguard/WireGuardPrefix';
import { GetDto } from './dto/get.dto';
import { StoreDto } from './dto/store.dto';
import { UpdateDto } from './dto/update.dto';
import { GetFirewallDto } from './dto/getFirewall.dto';
import { Channel } from '../../../sockets/channels/channel';
import { Crt } from '../../../models/vpn/pki/Crt';
import db from '../../../database/database-manager';
import { Firewall } from '../../../models/firewall/Firewall';
import { ProgressPayload } from '../../../sockets/messages/socket-message';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';

const fwcError = require('../../../utils/error_table');

export class WireGuardController extends Controller {
  @Validate(StoreDto)
  async store(req): Promise<ResponseBuilder> {
    try {
      // Initial validation
      if (
        req.tree_node.node_type !== 'WG' &&
        req.tree_node.node_type !== 'WGS' &&
        req.tree_node.node_type !== 'WGC'
      ) {
        throw new Error(fwcError.BAD_TREE_NODE);
      }
      if (req.body.wireguard && req.body.wireguard != req.tree_node.id_obj) {
        throw new Error("Information in node tree and in API request don't match");
      }
      if (req.crt.type === 1 && !req.body.wireguard) {
        throw new Error(
          'When using client certificates you must indicate the WireGuard server configuration',
        );
      }
      if (req.crt.type === 2 && req.body.wireguard) {
        throw new Error(
          'When using server certificates you must not indicate the WireGuard server configuration',
        );
      }
      if (req.crt.type === 1 && req.crt.ca !== req.wireguard.ca) {
        throw new Error(
          'CRT for a new client WireGuard configuration must has the same CA that the server WireGuard configuration to which it belongs',
        );
      }
      if (req.crt.type === 1 && req.body.firewall !== req.wireguard.firewall) {
        throw new Error(
          'Firewall ID for the new client WireGuard configuration must match server WireGuard configuration',
        );
      }
      // Create base configuration
      const newWireguard = await WireGuard.addCfg(req);

      // Insert options
      let order = 1;
      for (const opt of req.body.options) {
        // Validate option before inserting it
        if (!opt.name) {
          throw new Error(`Option is missing the 'name' field.`);
        }

        // Configure option
        opt.wireguard = newWireguard;
        opt.order = order++;
        await WireGuard.addCfgOpt(req, opt);
      }

      if (req.body.wireguard) {
        const wireguardCfg = await WireGuard.getCfg(req.dbCon, req.body.wireguard);
        const order = wireguardCfg?.options.reduce((max, opt) => Math.max(max, opt.order), 0) + 1;
        const scope = wireguardCfg?.options.find((opt) => opt.scope !== undefined)?.scope;
        const options = [
          {
            name: 'AllowedIPs',
            wireguard: req.body.wireguard,
            wireguard_cli: newWireguard,
            order: order,
            scope: scope,
          },
        ];
        await WireGuard.addCfgOpt(req, options);
      }

      // Create node in tree
      let nodeId;
      if (req.tree_node.node_type === 'WG') {
        nodeId = await Tree.newNode(
          req.dbCon,
          req.body.fwcloud,
          req.crt.cn,
          req.body.node_id,
          'WGS',
          newWireguard,
          322,
        );
      } else if (req.tree_node.node_type === 'WGS') {
        nodeId = await Tree.newNode(
          req.dbCon,
          req.body.fwcloud,
          req.crt.cn,
          req.body.node_id,
          'WGC',
          newWireguard,
          321,
        );
      }

      // Handle prefixes (if necessary)
      if (req.crt.type === 2) {
        // 1=Client certificate, 2=Server certificate.
        const prefixes = req.body.prefixes || [];
        for (const prefix of prefixes) {
          await WireGuard.addPrefix(newWireguard, prefix);
        }
        // If we are creaing a WireGuard server configuration, then create the VPN virtual network interface with its assigned IP.
        await WireGuard.createWireGuardServerInterface(req, newWireguard);
      }

      return ResponseBuilder.buildResponse()
        .status(201)
        .body({ insertId: newWireguard, TreeinsertId: nodeId });
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate()
  async install(req): Promise<ResponseBuilder> {
    try {
      const channel = await Channel.fromRequest(req);
      const cfgDump = await WireGuard.dumpCfg(req.dbCon, req.body.fwcloud, req.body.wireguard);
      const firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneOrFail({ where: { id: req.body.firewall } });
      const communication = await firewall.getCommunication({
        sshuser: req.body.sshuser,
        sshpassword: req.body.sshpass,
      });

      channel.emit('message', new ProgressPayload('start', false, 'Installing Wireguard'));

      let installDir = req.wireguard.install_dir;
      let installName = req.wireguard.install_name;
      if (!req.wireguard.install_dir || !req.wireguard.install_name) {
        const wireGuardCfg = await WireGuard.getCfg(req.dbCon, req.body.wireguard);
        if (wireGuardCfg.wireguard === null) {
          throw new Error('Empty install dir or install name');
        } else {
          const wireGuardParentCfg = await WireGuard.getCfg(req.dbCon, wireGuardCfg.wireguard);
          installDir = wireGuardParentCfg.install_dir;
          installName = wireGuardParentCfg.install_name;
        }
      }
      await communication.installOpenVPNServerConfigs(
        installDir,
        [
          {
            content: (cfgDump as any).cfg,
            name: installName,
          },
        ],
        channel,
      );

      // Update the status flag for the OpenVPN configuration.
      await WireGuard.updateWireGuardStatus(req.dbCon, req.body.wireguard, '&~1');

      // Update the install date.
      await WireGuard.updateWireGuardInstallDate(req.dbCon, req.body.wireguard);

      channel.emit('message', new ProgressPayload('end', false, 'Installing Wireguard'));
      return ResponseBuilder.buildResponse().status(200);
    } catch (error) {
      if (error instanceof HttpException) {
        return ResponseBuilder.buildResponse()
          .status(error.status)
          .body({ message: error.message });
      }

      if (error.message)
        return ResponseBuilder.buildResponse().status(400).body({ message: error.message });
      else return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate()
  async uninstall(req): Promise<ResponseBuilder> {
    try {
      const firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneOrFail({ where: { id: req.body.firewall } });
      const channel = await Channel.fromRequest(req);
      const communication = await firewall.getCommunication({
        sshuser: req.body.sshuser,
        sshpassword: req.body.sshpass,
      });

      channel.emit('message', new ProgressPayload('start', false, 'Uninstalling Wireguard'));

      if (!req.wireguard.install_dir || !req.wireguard.install_name)
        throw new Error('Empty install dir or install name');

      await communication.uninstallWireGuardConfigs(
        req.wireguard.install_dir,
        [req.wireguard.install_name],
        channel,
      );

      // Update the status flag for the OpenVPN configuration.
      await WireGuard.updateWireGuardStatus(req.dbCon, req.body.wireguard, '|1');

      channel.emit('message', new ProgressPayload('end', false, 'Uninstalling Wireguard'));

      return ResponseBuilder.buildResponse().status(200);
    } catch (error) {
      if (error instanceof HttpException) {
        return ResponseBuilder.buildResponse()
          .status(error.status)
          .body({ message: error.message });
      }

      if (error.message)
        return ResponseBuilder.buildResponse().status(400).body({ message: error.message });
      else return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(UpdateDto)
  async update(req): Promise<ResponseBuilder> {
    try {
      await WireGuard.updateCfg(req);

      await WireGuard.delCfgOptAll(req);

      let order = 1;
      for (const opt of req.body.options) {
        opt.wireguard = req.body.wireguard;
        opt.order = order++;
        await WireGuard.addCfgOpt(req, opt);
      }

      await WireGuard.updateWireGuardStatus(req.dbCon, req.body.wireguard, '|1');

      return ResponseBuilder.buildResponse().status(204);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async get(req): Promise<ResponseBuilder> {
    try {
      const data = await WireGuard.getCfg(req.dbCon, req.body.wireguard);
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async getFile(req): Promise<ResponseBuilder> {
    try {
      const cfgDump = await WireGuard.dumpCfg(req.dbCon, req.body.fwcloud, req.body.wireguard);
      return ResponseBuilder.buildResponse().status(200).body(cfgDump);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async getIpObj(req): Promise<ResponseBuilder> {
    try {
      const cfgData = await WireGuard.getCfg(req.dbCon, req.body.wireguard);
      const data = [];
      for (const opt of cfgData.options) {
        if (opt.ipobj) {
          data.push(await IPObj.getIpobjInfo(req.dbCon, req.body.fwcloud, opt.ipobj));
        }
      }
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async getIp(req): Promise<ResponseBuilder> {
    try {
      const freeIP = await WireGuard.freeVpnIP(req);
      return ResponseBuilder.buildResponse().status(200).body(freeIP);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async getInfo(req): Promise<ResponseBuilder> {
    try {
      const wireguardRecord = await WireGuard.getCfg(req.dbCon, req.body.wireguard);

      const data = await WireGuard.getWireGuardInfo(
        req.dbCon,
        req.body.fwcloud,
        req.body.wireguard,
        wireguardRecord.type,
      );
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetFirewallDto)
  async getFirewall(req): Promise<ResponseBuilder> {
    try {
      const data = await WireGuard.getWireGuardServersByFirewall(req.dbCon, req.body.firewall);
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async delete(req): Promise<ResponseBuilder> {
    try {
      if (req.wireguard?.type === 1) {
        await WireGuardPrefix.updateWireGuardClientPrefixesFWStatus(
          req.dbCon,
          req.body.fwcloud,
          req.body.wireguard,
        );
      }

      await WireGuard.delCfg(
        req.dbCon,
        req.body.fwcloud,
        req.body.wireguard,
        req.wireguard.type === 1,
      );

      if (req.wireguard?.type === 1) {
        await WireGuardPrefix.applyWireGuardPrefixes(
          req.dbCon,
          req.body.fwcloud,
          req.wireguard.wireguard,
        );
      } else {
        await Tree.deleteObjFromTree(req.body.fwcloud, req.body.wireguard, 322);
      }
      return ResponseBuilder.buildResponse().status(204);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate()
  async restricted(): Promise<ResponseBuilder> {
    try {
      return ResponseBuilder.buildResponse().status(204);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async where(req): Promise<ResponseBuilder> {
    try {
      const data = await WireGuard.searchWireGuardUsage(
        req.dbCon,
        req.body.fwcloud,
        req.body.wireguard,
        true,
      );
      if (data.result > 0) {
        return ResponseBuilder.buildResponse().status(200).body(data);
      } else {
        return ResponseBuilder.buildResponse().status(204);
      }
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate()
  async getConfigFilename(req): Promise<ResponseBuilder> {
    try {
      const data = await WireGuard.getConfigFilename(req.dbCon);
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async getClients(req): Promise<ResponseBuilder> {
    try {
      const data = await WireGuard.getWireGuardClients(req.dbCon, req.body.wireguard);
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }
}
