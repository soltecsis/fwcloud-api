import { IsOptional, IsString } from "class-validator";

export class RoutingGroupControllerCreateDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    comment: string;
}