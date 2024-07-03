import { Type } from 'class-transformer';
import { IsArray, IsNumber } from 'class-validator';

export class RoutingRuleControllerBulkRemoveQueryDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  rules: number[];
}
