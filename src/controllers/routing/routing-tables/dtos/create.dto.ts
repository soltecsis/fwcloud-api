import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class RoutingTableControllerCreateDto {
    @IsNumber()
    @Min(1)
    @Max(255)
    number: number;
    
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    comment: string;
}