import { IsNotEmpty, IsNumber } from 'class-validator';

export class GetFirewallDto {
  @IsNotEmpty()
  @IsNumber()
  fwcloud: number;

  @IsNotEmpty()
  @IsNumber()
  firewall: number;
}
