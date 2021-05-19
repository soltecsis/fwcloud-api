import { IsOptional, IsString } from "class-validator";

export class RoutingGroupControllerUpdateDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    comment: string;
}