import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, ValidateNested } from 'class-validator';
import { IPSecOptionDTO } from './store.dto';

export class UpdateOptionsDto {
  @IsNotEmpty()
  @IsNumber()
  fwcloud: number;

  @IsNotEmpty()
  @IsNumber()
  ipsec: number;

  @IsNotEmpty()
  @IsNumber()
  ipsec_cli: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IPSecOptionDTO)
  options: IPSecOptionDTO[];
}
