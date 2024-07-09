import { IsOptional, IsString } from 'class-validator';

export class VerifyTfaDto {
  @IsOptional()
  @IsString()
  authCode?: string;

  @IsString()
  tempSecret: string;
}
