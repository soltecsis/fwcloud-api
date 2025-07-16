import { Request } from 'express';
import { Validate } from '../../../decorators/validate.decorator';
import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { Firewall } from '../../../models/firewall/Firewall';
import { WireGuard } from '../../../models/vpn/wireguard/WireGuard';
import { WireGuardPrefixService } from '../../../models/vpn/wireguard/wireguard-prefix.service';
import { WireGuardPrefix } from '../../../models/vpn/wireguard/WireGuardPrefix';
import { app } from '../../../fonaments/abstract-application';
const fwcError = require('../../../utils/error_table');

export class WireGuardPrefixController extends Controller {
  protected wireGuardPrefixService: WireGuardPrefixService;

  async make() {
    this.wireGuardPrefixService = await app().getService<WireGuardPrefixService>(
      WireGuardPrefixService.name,
    );
  }
  @Validate()
  async prefix(req: any): Promise<ResponseBuilder> {
    try {
      // We can only create prefixes for OpenVPN server configurations.
      if (req.wireguard.type !== 2) throw fwcError.VPN_NOT_SER;

      // Verify that we are not creating a prefix that already exists for the same CA.
      if (await WireGuardPrefix.existsPrefix(req.dbCon, req.body.wireguard, req.body.name))
        throw fwcError.ALREADY_EXISTS;

      // Create the tree node.
      const id = (await WireGuardPrefix.createPrefix(req)) as number;

      // Apply the new CRT prefix container.
      await WireGuardPrefix.applyWireGuardPrefixes(req.dbCon, req.body.fwcloud, req.body.wireguard);

      // Mark firewalls using this prefix as needing an update.
      await this.wireGuardPrefixService.updateAffectedFirewalls(req.body.fwcloud, id);

      return ResponseBuilder.buildResponse().status(200).body({ insertId: id });
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate()
  async update(req: Request): Promise<ResponseBuilder> {
    try {
      await this.wireGuardPrefixService.update(req);

      const data_return = {};
      await Firewall.getFirewallStatusNotZero(req.body.fwcloud, data_return);
      await WireGuard.getWireGuardStatusNotZero(req, data_return);

      // Mark firewalls using this prefix as needing an update.
      await this.wireGuardPrefixService.updateAffectedFirewalls(req.body.fwcloud, req.body.prefix);

      return ResponseBuilder.buildResponse().status(204).body(data_return);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }

  @Validate()
  async getInfo(req: Request): Promise<ResponseBuilder> {
    try {
      const data = await WireGuardPrefix.getPrefixWireGuardInfo(
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
      const data = await WireGuardPrefix.searchPrefixUsage(
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
      // Delete prefix.
      await WireGuardPrefix.deletePrefix(req.dbCon, req.body.prefix);

      // Regenerate prefixes.
      await WireGuardPrefix.applyWireGuardPrefixes(
        req.dbCon,
        req.body.fwcloud,
        req.prefix.wireguard,
      );

      // Mark firewalls using this prefix as needing an update.
      await this.wireGuardPrefixService.updateAffectedFirewalls(req.body.fwcloud, req.body.prefix);

      return ResponseBuilder.buildResponse().status(204);
    } catch (error) {
      return ResponseBuilder.buildResponse().status(400).body(error);
    }
  }
}
