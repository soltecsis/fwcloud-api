import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, ValidateNested } from 'class-validator';
import { WireGuardOptionDTO } from './store.dto';

export class UpdateOptionsDto {
  @IsNotEmpty()
  @IsNumber()
  wireguard: number;

  @IsNotEmpty()
  @IsNumber()
  wireguard_cli: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WireGuardOptionDTO)
  options: WireGuardOptionDTO[];
}
