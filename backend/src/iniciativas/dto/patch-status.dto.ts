import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PatchStatusDto {
  @IsString()
  @IsNotEmpty()
  status: string = '';

  @IsOptional()
  @IsString()
  justificativa?: string;
}
