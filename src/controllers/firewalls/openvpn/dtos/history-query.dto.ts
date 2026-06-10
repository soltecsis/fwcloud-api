import { IsIn, IsIP, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class HistoryBaseQueryDto {
  @IsNumber()
  @IsOptional()
  starts_at: number;

  @IsNumber()
  @IsOptional()
  ends_at: number;

  @IsOptional()
  @IsString()
  name: string;

  @IsIP()
  @IsOptional()
  address: string;
}

export class HistoryQueryDto extends HistoryBaseQueryDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  page: number;

  @IsNumber()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit: number;

  @IsString()
  @IsIn(['cn', 'address', 'connected_at', 'disconnected_at', 'bytesReceived', 'bytesSent'])
  @IsOptional()
  sort: string;

  @IsString()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  @IsOptional()
  order: string;
}
