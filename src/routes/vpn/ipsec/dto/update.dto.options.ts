import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Validate,
  ValidateNested,
} from 'class-validator';
import { IPSecOptionDTO, IPSecPskKeyDependencyValidator } from './store.dto';

export class UpdateOptionsDto {
  @IsNotEmpty()
  @IsNumber()
  fwcloud: number;

  @IsNotEmpty()
  @IsNumber()
  ipsec: number;

  @IsOptional()
  @IsNotEmpty()
  @IsNumber()
  ipsec_cli?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Validate(IPSecPskKeyDependencyValidator)
  @Type(() => IPSecOptionDTO)
  options: IPSecOptionDTO[];
}
