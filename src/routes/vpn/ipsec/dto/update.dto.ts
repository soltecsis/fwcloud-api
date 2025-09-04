import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { IPSecOptionDTO } from './store.dto';

export class UpdateDto {
  @IsNotEmpty()
  @IsNumber()
  fwcloud: number;

  @IsNotEmpty()
  @IsNumber()
  firewall: number;

  @IsNotEmpty()
  @IsNumber()
  ipsec: number;

  @IsString()
  @IsOptional()
  install_dir?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9\-_.]{2,64}$/, { message: 'Invalid install_name format' })
  install_name?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IPSecOptionDTO)
  options: IPSecOptionDTO[];

  @IsString()
  @IsOptional()
  comment?: string;
}
