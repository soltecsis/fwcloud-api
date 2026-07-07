import { validate } from 'class-validator';
import { expect } from '../../../mocha/global-setup';
import sinon from 'sinon';
import db from '../../../../src/database/database-manager';
import { FirewallController } from '../../../../src/controllers/firewalls/firewall.controller';
import { PluginDto } from '../../../../src/controllers/firewalls/dtos/plugin.dto';
import {
  FirewallInstallCommunication,
  FirewallInstallProtocol,
  PluginsFlags,
} from '../../../../src/models/firewall/Firewall';
import { HttpException } from '../../../../src/fonaments/exceptions/http/http-exception';

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

describe(`${FirewallController.name} Suricata plugin parameters`, () => {
  let controller: FirewallController;

  beforeEach(() => {
    controller = new FirewallController(null as any);
  });

  afterEach(() => {
    sinon.restore();
  });

  function buildDto(pluginParams?: unknown): PluginDto {
    const dto = new PluginDto();
    dto.firewallId = 10;
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

  function stubInterfaceCount(count: number): void {
    const queryBuilder = {
      where: sinon.stub().returnsThis(),
      andWhere: sinon.stub().returnsThis(),
      getCount: sinon.stub().resolves(count),
    };
    const repository = {
      createQueryBuilder: sinon.stub().returns(queryBuilder),
    };

    sinon.stub(db, 'getSource').returns({
      manager: {
        getRepository: sinon.stub().returns(repository),
      },
    } as any);
  }

  it('should accept an existing FWCloud interface and an alphanumeric OINKCODE', async () => {
    stubInterfaceCount(1);

    await (controller as any).validateSuricataPluginParams(buildDto(['ens18', 'ABC123']));
  });

  it('should reject Suricata activation when the interface does not belong to the firewall', async () => {
    stubInterfaceCount(0);

    await expect(
      (controller as any).validateSuricataPluginParams(buildDto(['ens18', 'ABC123'])),
    ).to.be.rejectedWith(HttpException, 'Suricata network interface is not valid');
  });

  it('should reject non-alphanumeric Suricata OINKCODE values', async () => {
    stubInterfaceCount(1);

    await expect(
      (controller as any).validateSuricataPluginParams(buildDto(['ens18', 'ABC-123'])),
    ).to.be.rejectedWith(HttpException, 'Suricata OINKCODE must contain only letters and numbers');
  });

  it('should reject Suricata activation without plugin parameters', async () => {
    await expect((controller as any).validateSuricataPluginParams(buildDto())).to.be.rejectedWith(
      HttpException,
      'Suricata activation requires one interface and an optional OINKCODE',
    );
  });
});
