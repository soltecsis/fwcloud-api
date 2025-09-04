import { IsNotEmpty, IsNumber } from 'class-validator';

export class GetDto {
  @IsNotEmpty()
  @IsNumber()
  fwcloud: number;

  @IsNotEmpty()
  @IsNumber()
  ipsec: number;
}
