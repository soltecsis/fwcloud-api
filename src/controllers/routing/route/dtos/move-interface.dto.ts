import { IsNumber, IsOptional } from "class-validator";

export class RouteMoveInterfaceDto {
  @IsNumber()
  fromId: number;

  @IsNumber()
  toId: number;

  @IsNumber()
  @IsOptional()
  interfaceId?: number;
}
