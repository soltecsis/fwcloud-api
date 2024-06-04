import { Type } from "class-transformer";
import { IsArray, IsNumber } from "class-validator";

export class RouteControllerBulkRemoveQueryDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  routes: number[];
}
