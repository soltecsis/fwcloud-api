import { IsNumber, IsOptional } from "class-validator";
import { HistoryQueryDto } from "./history-query.dto";

export class GraphQueryDto extends HistoryQueryDto {
  @IsNumber()
  @IsOptional()
  limit: number;
}
