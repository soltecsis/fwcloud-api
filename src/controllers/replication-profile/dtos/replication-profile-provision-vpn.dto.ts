import { Type } from 'class-transformer';
import { IsObject, IsOptional, ValidateNested } from 'class-validator';
import { ReplicationProfileApplyTargetDto } from './replication-profile-apply.dto';

/**
 * Creates a profile's VPN template for real ahead of an apply() call that binds to the result — see
 * ProfileApplicationService.provisionVpn(). Deliberately smaller than
 * ReplicationProfileApplyDto: there is no mode (this always creates real resources) and no
 * source profile (VPN templates only exist on provisioning profiles).
 */
export class ReplicationProfileProvisionVpnDto {
  @ValidateNested()
  @Type(() => ReplicationProfileApplyTargetDto)
  target: ReplicationProfileApplyTargetDto;

  /**
   * Values for the profile's declared parameters, keyed by parameter name. Only the VPN-related
   * ones (network/endpoint per connection) are actually read at this step.
   */
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}
