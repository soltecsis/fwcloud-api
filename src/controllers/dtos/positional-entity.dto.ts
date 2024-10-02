import { IsNumber } from 'class-validator';

export class PositionalEntityDto {
  @IsNumber()
  id: number;

  @IsNumber()
  order: number;
}
