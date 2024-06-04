import { Type } from "class-transformer";
import { IsArray, IsNumber, IsOptional } from "class-validator";

export class RoutingTableControllerCompileRoutesQueryDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  routes?: number[];
}
