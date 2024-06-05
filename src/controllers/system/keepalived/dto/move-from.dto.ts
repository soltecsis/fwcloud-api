import { IsNumber, IsOptional } from 'class-validator';

export class KeepalivedMoveFromDto {
  @IsNumber()
  fromId: number;

  @IsNumber()
  toId: number;

  @IsNumber()
  @IsOptional()
  ipObjId?: number;
}
