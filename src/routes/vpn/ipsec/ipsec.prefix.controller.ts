import { Request } from 'express';
import { Validate } from '../../../decorators/validate.decorator';
import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { Firewall } from '../../../models/firewall/Firewall';
import { IPSec } from '../../../models/vpn/ipsec/IPSec';
import { IPSecPrefixService } from '../../../models/vpn/ipsec/ipsec-prefix.service';
import { IPSecPrefix } from '../../../models/vpn/ipsec/IPSecPrefix';
import { app } from '../../../fonaments/abstract-application';
const fwcError = require('../../../utils/error_table');

export class IPSecPrefixController extends Controller {
  protected ipsecPrefixService: IPSecPrefixService;

  async make() {
    this.ipsecPrefixService = await app().getService<IPSecPrefixService>(IPSecPrefixService.name);
  }
  @Validate()
  async prefix(req: any): Promise<ResponseBuilder> {
    try {
      // We can only create prefixes for OpenVPN server configurations.
      if (req.ipsec.type !== 2) throw fwcError.VPN_NOT_SER;

      // Verify that we are not creating a prefix that already exists for the same CA.
      if (await IPSecPrefix.existsPrefix(req.dbCon, req.body.ipsec, req.body.name))
        throw fwcError.ALREADY_EXISTS;

      // Create the tree node.
      const id = (await IPSecPrefix.createPrefix(req)) as number;

      // Apply the new CRT prefix container.
      await IPSecPrefix.applyIPSecPrefixes(req.dbCon, req.body.fwcloud, req.body.ipsec);

      // Mark firewalls using this prefix as needing an update.
      await this.ipsecPrefixService.updateAffectedFirewalls(req.body.fwcloud, id);

      return ResponseBuilder.buildResponse().status(200).body({ insertId: id });
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate()
  async update(req: Request): Promise<ResponseBuilder> {
    try {
      await this.ipsecPrefixService.update(req);

      const data_return = {};
      await Firewall.getFirewallStatusNotZero(req.body.fwcloud, data_return);
      await IPSec.getIPSecStatusNotZero(req, data_return);

      // Mark firewalls using this prefix as needing an update.
      await this.ipsecPrefixService.updateAffectedFirewalls(req.body.fwcloud, req.body.prefix);

      return ResponseBuilder.buildResponse().status(204).body(data_return);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate()
  async getInfo(req: Request): Promise<ResponseBuilder> {
    try {
      const data = await IPSecPrefix.getPrefixIPSecInfo(
        req.dbCon,
        req.body.fwcloud,
        req.body.prefix,
      );
      return ResponseBuilder.buildResponse().status(200).body(data[0]);
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

  @Validate()
  async where(req: Request): Promise<ResponseBuilder> {
    try {
      const data = await IPSecPrefix.searchPrefixUsage(
        req.dbCon,
        req.body.fwcloud,
        req.body.prefix,
        true,
      );
      if ((data as any).result) return ResponseBuilder.buildResponse().status(200).body(data);
      else return ResponseBuilder.buildResponse().status(204);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate()
  async delete(req: any): Promise<ResponseBuilder> {
    try {
      // Mark firewalls using this prefix as needing an update.
      await this.ipsecPrefixService.updateAffectedFirewalls(req.body.fwcloud, req.body.prefix);

      // Delete prefix.
      await IPSecPrefix.deletePrefix(req.dbCon, req.body.prefix);

      // Regenerate prefixes.
      await IPSecPrefix.applyIPSecPrefixes(req.dbCon, req.body.fwcloud, req.prefix.ipsec);

      return ResponseBuilder.buildResponse().status(204);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }
}
