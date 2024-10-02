import { IsNumber, IsOptional } from 'class-validator';

export class HAProxyMoveFromDto {
  @IsNumber()
  fromId: number;

  @IsNumber()
  toId: number;

  @IsNumber()
  @IsOptional()
  ipObjId?: number;
}
