import { IsNumber, IsString } from "class-validator";

export class SetupTfaDto{
    @IsString()
    username: string;

    @IsNumber()
    user: number;
}