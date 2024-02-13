import { IsNumber, IsOptional } from "class-validator";

export class DHCPRuleMoveFromDto {
    @IsNumber()
    fromId: number;

    @IsNumber()
    toId: number;

    @IsNumber()
    @IsOptional()
    ipObjId?: number;
}