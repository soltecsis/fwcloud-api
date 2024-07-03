import { IsOptional, IsString } from 'class-validator';

export class CrtControllerUpdateDto {
  @IsString()
  @IsOptional()
  comment: string;
}
