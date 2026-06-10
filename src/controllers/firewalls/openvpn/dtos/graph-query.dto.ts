import { IsNumber, IsOptional } from 'class-validator';
import { HistoryBaseQueryDto } from './history-query.dto';

export class GraphQueryDto extends HistoryBaseQueryDto {
  @IsNumber()
  @IsOptional()
  limit: number;
}
