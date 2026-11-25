import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { expect } from '../../../mocha/global-setup';
import { ClusterPolicyInstallDto } from '../../../../src/controllers/firewalls/dtos/cluster-policy-install.dto';

describe('cluster policy installation request', () => {
  it('accepts ordered node credentials', async () => {
    const input = plainToInstance(ClusterPolicyInstallDto, {
      nodes: [
        { firewallId: 1, sshuser: 'encrypted-user', sshpass: 'encrypted-password' },
        { firewallId: 2 },
      ],
    });
    expect(await validate(input)).to.have.length(0);
  });

  it('rejects an empty list and invalid node identifiers', async () => {
    const empty = plainToInstance(ClusterPolicyInstallDto, { nodes: [] });
    const invalid = plainToInstance(ClusterPolicyInstallDto, { nodes: [{ firewallId: 0 }] });
    expect(await validate(empty)).not.to.be.empty;
    expect(await validate(invalid)).not.to.be.empty;
  });
});
