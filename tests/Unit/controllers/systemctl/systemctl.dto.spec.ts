import { validate } from 'class-validator';
import { expect } from '../../../mocha/global-setup';
import { SystemCtlDto } from '../../../../src/controllers/systemctl/dtos/systemctl.dto';

describe(SystemCtlDto.name, () => {
  function buildDto(service: string): SystemCtlDto {
    const dto = new SystemCtlDto();
    dto.fwcloud = 1;
    dto.firewall = 1;
    dto.command = 'status';
    dto.service = service;

    return dto;
  }

  it('should accept OpenVPN systemctl service names', async () => {
    expect(await validate(buildDto('openvpn@firewall1'))).to.be.empty;
    expect(await validate(buildDto('openvpn-server@firewall1'))).to.be.empty;
  });

  it('should reject invalid OpenVPN systemctl service names', async () => {
    const errors = await validate(buildDto('openvpn-server'));

    expect(errors.map((error) => error.property)).to.include('service');
  });
});
