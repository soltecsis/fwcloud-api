import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { Validate } from '../../../decorators/validate.decorator';
import { IPSec } from '../../../models/vpn/ipsec/IPSec';
import { Tree } from '../../../models/tree/Tree';
import { IPObj } from '../../../models/ipobj/IPObj';
import { IPSecPrefix } from '../../../models/vpn/ipsec/IPSecPrefix';
import { GetDto } from './dto/get.dto';
import { StoreDto } from './dto/store.dto';
import { UpdateDto } from './dto/update.dto';
import { GetFirewallDto } from './dto/getFirewall.dto';
import { Channel } from '../../../sockets/channels/channel';
import db from '../../../database/database-manager';
import { Firewall } from '../../../models/firewall/Firewall';
import { ProgressNoticePayload, ProgressPayload } from '../../../sockets/messages/socket-message';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { PgpHelper } from '../../../utils/pgp';
import { Request } from 'express';
import { IPSecOption } from '../../../models/vpn/ipsec/ipsec-option.model';
import { GetOptionsDto } from './dto/get.dto.options';
import { UpdateOptionsDto } from './dto/update.dto.options';

const fwcError = require('../../../utils/error_table');

export class IPSecController extends Controller {
  @Validate(StoreDto)
  async store(req: any): Promise<ResponseBuilder> {
    try {
      // Initial validation
      if (
        req.tree_node.node_type !== 'IS' &&
        req.tree_node.node_type !== 'ISS' &&
        req.tree_node.node_type !== 'ISC'
      ) {
        throw new Error(fwcError.BAD_TREE_NODE);
      }
      if (req.body.ipsec && req.body.ipsec != req.tree_node.id_obj) {
        throw new Error("Information in node tree and in API request don't match");
      }
      if (req.crt.type === 1 && !req.body.ipsec) {
        throw new Error(
          'When using client certificates you must indicate the IPSec server configuration',
        );
      }
      if (req.crt.type === 2 && req.body.ipsec) {
        throw new Error(
          'When using server certificates you must not indicate the IPSec server configuration',
        );
      }
      if (req.crt.type === 1 && req.crt.ca !== req.ipsec.ca) {
        throw new Error(
          'CRT for a new client IPSec configuration must has the same CA that the server IPSec configuration to which it belongs',
        );
      }
      if (req.crt.type === 1 && req.body.firewall !== req.ipsec.firewall) {
        throw new Error(
          'Firewall ID for the new client IPSec configuration must match server IPSec configuration',
        );
      }
      if (req.crt.type === 2 && !req.body.ipsec) {
        const exists = (await IPSec.getIPSecServersByFirewall(
          req.dbCon,
          req.body.firewall,
        )) as IPSec[];
        if (exists.length > 0) {
          throw new Error('This firewall already has an IPSec server configured');
        }
      }

      // Create base configuration
      const newIpsec = await IPSec.addCfg(req);

      // Insert options
      let order = 1;
      for (const opt of req.body.options) {
        // Validate option before inserting it
        if (!opt.name) {
          throw new Error(`Option is missing the 'name' field.`);
        }

        // Configure option
        opt.ipsec = newIpsec;
        opt.order = order++;
        await IPSec.addCfgOpt(req, opt);
      }
      if (req.body.ipsec) {
        const ipsecCfg = await IPSec.getCfg(req.dbCon, req.body.ipsec);

        // Find leftsubnet option
        const leftSubnetOption = ipsecCfg?.options.find(
          (opt: IPSecOption) => opt.name === 'leftsubnet',
        );
        const leftSubnetValue = leftSubnetOption?.arg || '';

        let baseOrder =
          ipsecCfg?.options.reduce((max: number, opt: IPSecOption) => Math.max(max, opt.order), 0) +
          1;

        const options = [
          {
            name: 'rightsubnet',
            ipsec: req.body.ipsec,
            ipsec_cli: newIpsec,
            arg: leftSubnetValue, // Assign leftsubnet value
            order: baseOrder,
            scope: 8,
          },
          {
            name: 'auto',
            ipsec: req.body.ipsec,
            ipsec_cli: newIpsec,
            arg: 'start',
            order: baseOrder++,
            scope: 8,
          },
        ];
        // Use Promise.all to add all the options concurrently
        await Promise.all(options.map((opt) => IPSec.addCfgOpt(req, opt)));
      }

      // Create node in tree
      let nodeId: unknown;
      if (req.tree_node.node_type === 'IS') {
        nodeId = await Tree.newNode(
          req.dbCon,
          req.body.fwcloud,
          req.crt.cn,
          req.body.node_id,
          'ISS',
          newIpsec,
          332,
        );
      } else if (req.tree_node.node_type === 'ISS') {
        nodeId = await Tree.newNode(
          req.dbCon,
          req.body.fwcloud,
          req.crt.cn,
          req.body.node_id,
          'ISC',
          newIpsec,
          331,
        );
        await IPSecPrefix.applyIPSecPrefixes(req.dbCon, req.body.fwcloud, req.body.ipsec);
        await IPSecPrefix.updateIPSecClientPrefixesFWStatus(req.dbCon, req.body.fwcloud, newIpsec);
      }

      // Handle prefixes (if necessary)
      if (req.crt.type === 2) {
        // 1=Client certificate, 2=Server certificate.
        const prefixes = req.body.prefixes || [];
        for (const prefix of prefixes) {
          await IPSec.addPrefix(newIpsec, prefix);
        }
        // If we are creaing a IPSec server configuration, then create the VPN virtual network interface with its assigned IP.
        await IPSec.createIPSecServerInterface(req, newIpsec);
      }
      // Mark server as modified (need to be reinstalled)
      if (req.body.ipsec && req.tree_node.node_type === 'ISS') {
        await IPSec.updateIPSecStatus(req.dbCon, req.body.ipsec, '|1');
      }
      return ResponseBuilder.buildResponse()
        .status(201)
        .body({ insertId: newIpsec, TreeinsertId: nodeId });
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate()
  async install(req: any): Promise<ResponseBuilder> {
    try {
      const channel = await Channel.fromRequest(req);

      const firewall = await db
        .getSource()
        .manager.getRepository(Firewall)
        .findOneOrFail({ where: { id: req.body.firewall } });
      const communication = await firewall.getCommunication({
        sshuser: req.body.sshuser,
        sshpassword: req.body.sshpass,
      });

      let { install_dir: installDir, install_name: installName } = req.ipsec;
      let cfgDump = null;
      let isClient = false;
      if (!installDir || !installName) {
        const ipsecCfg = await IPSec.getCfg(req.dbCon, req.body.ipsec);
        if (!ipsecCfg.ipsec) {
          throw new Error('Empty install dir or install name');
        } else {
          const ipsecParentCfg = await IPSec.getCfg(req.dbCon, ipsecCfg.ipsec);
          installDir = ipsecParentCfg.install_dir;
          installName = ipsecParentCfg.install_name;
          cfgDump = await IPSec.dumpCfg(req.dbCon, ipsecCfg.ipsec);
          isClient = true;
        }
      } else {
        cfgDump = await IPSec.dumpCfg(req.dbCon, req.body.ipsec);
      }

      channel.emit('message', new ProgressPayload('start', false, 'Installing Ipsec'));
      await communication.installIPSecServerConfigs(
        installDir,
        [
          {
            content: (cfgDump as any).cfg,
            name: installName,
          },
        ],
        channel,
      );

      if ((cfgDump as any).ca_cert) {
        await communication.installIPSecServerConfigs(
          '/etc/ipsec.d/cacerts',
          [
            {
              content: (cfgDump as any).ca_cert,
              name: 'ca-cert.crt',
            },
          ],
          channel,
        );
      }

      if ((cfgDump as any).private_key) {
        await communication.installIPSecServerConfigs(
          '/etc/ipsec.d/private',
          [
            {
              content: (cfgDump as any).private_key,
              name: `${cfgDump.cn}.key`,
            },
          ],
          channel,
        );
      }

      if ((cfgDump as any).cert) {
        await communication.installIPSecServerConfigs(
          '/etc/ipsec.d/certs',
          [
            {
              content: (cfgDump as any).cert,
              name: `${cfgDump.cn}.crt`,
            },
          ],
          channel,
        );
      }

      await communication.installIPSecServerConfigs(
        '/etc',
        [
          {
            content: `:RSA ${cfgDump.cn}.key`,
            name: 'ipsec.secrets',
          },
        ],
        channel,
      );

      // Update the status flag for the Ipsec configuration.
      await IPSec.updateIPSecStatus(req.dbCon, req.body.ipsec, '&~1');

      // Update the installation date.
      await IPSec.updateIPSecInstallDate(req.dbCon, req.body.ipsec);

      channel.emit('message', new ProgressPayload('end', false, 'Installing Ipsec'));
      if (isClient) {
        return ResponseBuilder.buildResponse().status(200).body({ installName: installName });
      } else {
        return ResponseBuilder.buildResponse().status(200);
      }
    } catch (error) {
      if (error instanceof HttpException) {
        return ResponseBuilder.buildResponse()
          .status(error.status)
          .body({ message: error.message });
      }
      if (error.message) {
        return ResponseBuilder.buildResponse().status(400).body({ message: error.message });
      } else {
        return ResponseBuilder.buildResponse().status(400).body(error);
      }
    }
  }

  @Validate()
  async uninstall(req: any): Promise<ResponseBuilder> {
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

      channel.emit('message', new ProgressPayload('start', false, 'Uninstalling Ipsec'));

      if (!req.ipsec.install_dir || !req.ipsec.install_name)
        throw new Error('Empty install dir or install name');

      await communication.uninstallIPSecConfigs(
        req.ipsec.install_dir,
        [req.ipsec.install_name],
        channel,
      );

      // Update the status flag for the OpenVPN configuration.
      await IPSec.updateIPSecStatus(req.dbCon, req.body.ipsec, '|1');

      channel.emit('message', new ProgressPayload('end', false, 'Uninstalling Ipsec'));

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
  async update(req: Request): Promise<ResponseBuilder> {
    try {
      await IPSec.updateCfg(req);

      const isServer = await IPSec.isIPSecServer(req.dbCon, req.body.ipsec);
      if (isServer) {
        await IPSec.delCfgOptByScope(req, 6);
      } else {
        await IPSec.delCfgOptAll(req);
      }

      let order = 1;
      for (const opt of req.body.options) {
        opt.ipsec = req.body.ipsec;
        opt.order = order++;
        await IPSec.addCfgOpt(req, opt);
      }

      const data = await IPSec.getCfg(req.dbCon, req.body.ipsec);

      if (data.ipsec === null) {
        await IPSec.updateIPSecServerInterface(req);
        await IPSec.updateIPSecStatus(req.dbCon, data.id, '|1');
      } else if (data.ipsec !== null && data.id !== null) {
        await IPSec.updateIPSecStatus(req.dbCon, req.body.ipsec, '|1');
      }

      return ResponseBuilder.buildResponse().status(204);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async get(req: any): Promise<ResponseBuilder> {
    try {
      const data = await IPSec.getCfg(req.dbCon, req.body.ipsec);
      if (data) {
        return ResponseBuilder.buildResponse().status(200).body(data);
      }
      return ResponseBuilder.buildResponse().status(204);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async getFile(req: Request): Promise<ResponseBuilder> {
    try {
      const cfgDump = await IPSec.dumpCfg(req.dbCon, req.body.ipsec);
      return ResponseBuilder.buildResponse().status(200).body(cfgDump);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async getIpObj(req: Request): Promise<ResponseBuilder> {
    try {
      const cfgData = await IPSec.getCfg(req.dbCon, req.body.ipsec);
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
  async getIp(req: Request): Promise<ResponseBuilder> {
    try {
      const freeIP = await IPSec.freeVpnIP(req);
      return ResponseBuilder.buildResponse().status(200).body(freeIP);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async getInfo(req: Request): Promise<ResponseBuilder> {
    try {
      const ipsecRecord = await IPSec.getCfg(req.dbCon, req.body.ipsec);

      const data = await IPSec.getIPSecInfo(
        req.dbCon,
        req.body.fwcloud,
        req.body.ipsec,
        ipsecRecord.type,
      );

      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetFirewallDto)
  async getFirewall(req: Request): Promise<ResponseBuilder> {
    try {
      const data = await IPSec.getIPSecServersByFirewall(req.dbCon, req.body.firewall);
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async delete(req: any): Promise<ResponseBuilder> {
    try {
      if (req.ipsec?.type === 1) {
        await IPSecPrefix.updateIPSecClientPrefixesFWStatus(
          req.dbCon,
          req.body.fwcloud,
          req.body.ipsec,
        );
      }

      await IPSec.delCfg(req.dbCon, req.body.fwcloud, req.body.ipsec, req.ipsec.type === 1);

      if (req.ipsec?.type === 1) {
        await IPSecPrefix.applyIPSecPrefixes(req.dbCon, req.body.fwcloud, req.ipsec.ipsec);

        await IPSec.updateIPSecStatus(req.dbCon, req.ipsec.ipsec, '|1');
      } else {
        await Tree.deleteObjFromTree(req.body.fwcloud, req.body.ipsec, 332);
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
  async where(req: Request): Promise<ResponseBuilder> {
    try {
      const data = await IPSec.searchIPSecUsage(req.dbCon, req.body.fwcloud, req.body.ipsec, true);
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
  async getConfigFilename(req: Request): Promise<ResponseBuilder> {
    try {
      const data = await IPSec.getConfigFilename(req.dbCon, req.body.firewall);
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetDto)
  async getClients(req: any): Promise<ResponseBuilder> {
    try {
      const data: any[] = await IPSec.getIPSecClients(req.dbCon, req.body.ipsec);
      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(GetOptionsDto)
  async getClientOptions(req: any): Promise<ResponseBuilder> {
    try {
      const data = await IPSec.getPeerOptions(req.dbCon, req.body.ipsec, req.body.ipsec_cli);

      return ResponseBuilder.buildResponse().status(200).body(data);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate(UpdateOptionsDto)
  async updateClientOptions(req: any): Promise<ResponseBuilder> {
    try {
      await IPSec.delCfgOptByScope(req, 8);

      const clientOptions = (await IPSec.getOptData(req.dbCon, req.body.ipsec_cli)) as any[];
      let maxOrder = clientOptions.reduce((max: number, opt: any) => Math.max(max, opt.order), 0);
      if (maxOrder === 0) {
        maxOrder = 1; // Start from 1 if no options exist
      } else {
        maxOrder++; // Increment to ensure new options are added after existing ones
      }
      for (const opt of req.body.options) {
        if (opt.name === 'rightsourceip') {
          continue;
        }
        // Configure option
        opt.ipsec = req.body.ipsec;
        opt.ipsec_cli = req.body.ipsec_cli;
        opt.ipobj = null;
        opt.order = maxOrder++;
        await IPSec.addCfgOpt(req, opt);
      }

      return ResponseBuilder.buildResponse().status(204);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }
}
