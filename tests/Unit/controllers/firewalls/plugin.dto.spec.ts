import { validate } from 'class-validator';
import { expect } from '../../../mocha/global-setup';
import { PluginDto } from '../../../../src/controllers/firewalls/dtos/plugin.dto';
import {
  FirewallInstallCommunication,
  FirewallInstallProtocol,
  PluginsFlags,
} from '../../../../src/models/firewall/Firewall';

describe(PluginDto.name, () => {
  function buildDto(pluginParams?: unknown): PluginDto {
    const dto = new PluginDto();
    dto.communication = FirewallInstallCommunication.Agent;
    dto.host = '192.0.2.10';
    dto.port = 33033;
    dto.protocol = FirewallInstallProtocol.HTTPS;
    dto.apikey = 'encrypted-apikey';
    dto.plugin = PluginsFlags.suricata;
    dto.enable = true;
    dto.pluginParams = pluginParams as string[];

    return dto;
  }

  it('should accept optional generic plugin parameters', async () => {
    const errors = await validate(buildDto(['ens18', 'OINKCODE']));

    expect(errors).to.be.empty;
  });

  it('should accept requests without generic plugin parameters', async () => {
    const errors = await validate(buildDto());

    expect(errors).to.be.empty;
  });

  it('should reject non-string generic plugin parameters', async () => {
    const errors = await validate(buildDto(['ens18', 123]));

    expect(errors.map((error) => error.property)).to.include('pluginParams');
  });
});
