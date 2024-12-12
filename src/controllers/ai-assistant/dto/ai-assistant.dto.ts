import { IsString, IsOptional } from 'class-validator';

export class AiAssistantDto {
  @IsString()
  prompt: string;
}
