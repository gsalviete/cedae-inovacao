import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PatchEtapaDto {
  @IsString()
  @IsNotEmpty()
  etapa: string = '';

  @IsOptional()
  @IsString()
  justificativa?: string;
}
