import { IsOptional, IsString } from "class-validator";

export class RoutingTableControllerUpdateDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    comment: string;
}