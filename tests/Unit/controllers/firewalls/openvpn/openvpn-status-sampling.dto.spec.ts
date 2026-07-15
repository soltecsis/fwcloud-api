import { validate } from 'class-validator';
import { OpenVPNStatusSamplingUpdateDto } from '../../../../../src/controllers/firewalls/openvpn/dtos/status-sampling.dto';
import { expect } from '../../../../mocha/global-setup';

describe(OpenVPNStatusSamplingUpdateDto.name, () => {
  function buildDto(
    overrides: Partial<OpenVPNStatusSamplingUpdateDto> = {},
  ): OpenVPNStatusSamplingUpdateDto {
    const dto = new OpenVPNStatusSamplingUpdateDto();
    dto.enabled = true;
    dto.status_file = '/run/openvpn/server.status';
    dto.sampling_interval = 30;
    dto.request_max_lines = 1000;
    dto.cache_max_size = 10485760;

    return Object.assign(dto, overrides);
  }

  it('should accept valid OpenVPN status sampling parameters', async () => {
    expect(await validate(buildDto())).to.be.empty;
  });

  it('should reject sampling parameters lower than 1', async () => {
    const errors = await validate(buildDto({ sampling_interval: 0 }));

    expect(errors.map((error) => error.property)).to.include('sampling_interval');
  });

  it('should reject non-integer sampling parameters', async () => {
    const errors = await validate(buildDto({ request_max_lines: 10.5 }));

    expect(errors.map((error) => error.property)).to.include('request_max_lines');
  });
});
