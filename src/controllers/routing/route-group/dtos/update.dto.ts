import { IsOptional, IsString } from "class-validator";

export class RouteGroupControllerUpdateDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    comment: string;
}