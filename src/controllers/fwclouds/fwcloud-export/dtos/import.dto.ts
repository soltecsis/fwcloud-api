import { IsOptional, IsString, Length, Validate } from "class-validator";
import { FileInfo } from "../../../../fonaments/http/files/file-info";
import { HasExtension } from "../../../../fonaments/validation/rules/extension.validation";
import { IsFile } from "../../../../fonaments/validation/rules/file.validation";

export class FwCloudExportControllerImportDto {
    @Validate(IsFile)
    @Validate(HasExtension, ['fwcloud'])
    file: FileInfo;

    @IsString()
    @Length(0,255)
    @IsOptional()
    channel_id: string;
}