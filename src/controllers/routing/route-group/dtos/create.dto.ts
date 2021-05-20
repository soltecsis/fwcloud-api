import { IsOptional, IsString } from "class-validator";

export class RouteGroupControllerCreateDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    comment: string;
}