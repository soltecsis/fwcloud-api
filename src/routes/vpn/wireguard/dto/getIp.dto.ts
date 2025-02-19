import { IsNotEmpty, IsNumber } from 'class-validator';

export class GetIpDto {
  @IsNotEmpty()
  @IsNumber()
  fwcloud: number;

  @IsNotEmpty()
  @IsNumber()
  wireguard: number;
}
