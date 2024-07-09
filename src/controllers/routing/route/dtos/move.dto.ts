import { IsArray, IsEnum, IsNumber, IsPositive } from 'class-validator';
import { Offset } from '../../../../offset';

export class RouteControllerMoveDto {
  @IsNumber()
  @IsPositive()
  to: number;

  @IsEnum(Offset)
  offset: Offset;

  @IsArray()
  @IsNumber({}, { each: true })
  routes: number[];
}
