import { IsString } from 'class-validator';

export class AiAssistantCredentialDto {
  @IsString()
  ai: string;

  @IsString()
  model: string;

  @IsString()
  apiKey: string;
}
