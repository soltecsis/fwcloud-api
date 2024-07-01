import { IsArray, IsEnum, IsNumber, IsPositive } from 'class-validator';
import { Offset } from '../../../../offset';

export class RoutingRuleControllerMoveDto {
  @IsNumber()
  @IsPositive()
  to: number;

  @IsEnum(Offset)
  offset: Offset;

  @IsArray()
  @IsNumber({}, { each: true })
  rules: number[];
}
