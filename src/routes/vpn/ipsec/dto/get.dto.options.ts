import { IsNotEmpty, IsNumber } from 'class-validator';

export class GetOptionsDto {
  @IsNotEmpty()
  @IsNumber()
  fwcloud: number;

  @IsNotEmpty()
  @IsNumber()
  ipsec: number;

  @IsNotEmpty()
  @IsNumber()
  ipsec_cli: number;
}
