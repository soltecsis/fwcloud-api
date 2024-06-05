import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional } from 'class-validator';

export class FirewallControllerCompileRoutingRuleQueryDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  rules?: number[];
}
