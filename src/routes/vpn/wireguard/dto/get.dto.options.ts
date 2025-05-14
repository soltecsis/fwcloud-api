import { IsNotEmpty, IsNumber } from 'class-validator';

export class GetOptionsDto {
  @IsNotEmpty()
  @IsNumber()
  fwcloud: number;

  @IsNotEmpty()
  @IsNumber()
  wireguard: number;

  @IsNotEmpty()
  @IsNumber()
  wireguard_cli: number;
}
