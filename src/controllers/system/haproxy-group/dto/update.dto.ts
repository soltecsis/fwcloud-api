import { ArrayMinSize, IsNumber, IsOptional, IsString } from 'class-validator';

export class DHCPGroupControllerUpdateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  style?: string;

  @IsOptional()
  @IsNumber({}, { each: true })
  @ArrayMinSize(0)
  rules?: number[];
}
