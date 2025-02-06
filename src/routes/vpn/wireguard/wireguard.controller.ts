import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { Validate } from '../../../decorators/validate.decorator';
import { WireGuard } from '../../../models/vpn/wireguard/WireGuard';
import { Tree } from '../../../models/tree/Tree';
import { IPObj } from '../../../models/ipobj/IPObj';

const fwcError = require('../../../utils/error_table');

export class WireGuardController extends Controller {
  @Validate()
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
      const newWireguard = await WireGuard.addCfg({
        wireguard: req.body.wireguard,
        firewall: req.body.firewall,
        crt: req.body.crt,
        install_dir: req.body.install_dir,
        install_name: req.body.install_name,
        comment: req.body.comment || null,
        status: 1, // Default active configuration
      });
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
          323,
        );
      }

      // Handle prefixes (if necessary)
      if (req.crt.type === 2) {
        const prefixes = req.body.prefixes || [];
        for (const prefix of prefixes) {
          await WireGuard.addPrefix(newWireguard, prefix);
        }
      }

      return ResponseBuilder.buildResponse()
        .status(201)
        .body({ insertId: newWireguard, TreeinsertId: nodeId });
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

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

  async get(req): Promise<ResponseBuilder> {
    try {
      const data = await WireGuard.getCfg(req);
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  async getFile(req): Promise<ResponseBuilder> {
    try {
      const cfgDump = await WireGuard.dumpCfg(req.dbCon, req.body.fwcloud, req.body.wireguard);
      return ResponseBuilder.buildResponse().status(200).body(cfgDump);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  async getIpObj(req): Promise<ResponseBuilder> {
    try {
      const cfgData = await WireGuard.getCfg(req);
      const data = [];
      for (const opt of cfgData.options) {
        if (opt.ipobj) {
          data.push(await IPObj.getIpobjInfo(req.dbCon, req.body.fwcloud, opt.ipobj));
        }
      }
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate()
  async getIp(req): Promise<ResponseBuilder> {
    try {
      const freeIP = await WireGuard.freeVpnIP(req);
      return ResponseBuilder.buildResponse().status(200).body(freeIP);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate()
  async getInfo(req): Promise<ResponseBuilder> {
    try {
      const wireguardRecord = await WireGuard.getCfg(req);

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

  async getFirewall(req): Promise<ResponseBuilder> {
    try {
      const data = await WireGuard.getWireGuardServersByFirewall(req.dbCon, req.body.firewall);
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  //TODO: restriced check
  async delete(req): Promise<ResponseBuilder> {
    try {
      if (req.wireguard.type === 1) {
        await WireGuard.delCfg(req.dbCon, req.body.fwcloud, req.body.wireguard);
      }

      await WireGuard.delCfg(req.dbCon, req.body.fwcloud, req.body.wireguard);

      if (req.wireguard.type === 1) {
        // TODO: Prefixes
      } else {
        await Tree.deleteObjFromTree(req.body.fwcloud, req.body.wireguard, 322);
      }

      return ResponseBuilder.buildResponse().status(204);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  //TODO: restriced check
  async restricted(/*req*/): Promise<ResponseBuilder> {
    return ResponseBuilder.buildResponse().status(204);
  }

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

  async getConfigFilename(req): Promise<ResponseBuilder> {
    try {
      const data = await WireGuard.getConfigFilename(
        req.dbCon,
        req.body.fwcloud,
        req.body.wireguard,
      );
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  async getClients(req): Promise<ResponseBuilder> {
    try {
      const data = await WireGuard.getWireGuardClients(req.dbCon, req.body.fwcloud);
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }
}
