import { IsOptional, IsString } from 'class-validator';

export class EditarHistoricoDto {
  @IsOptional()
  @IsString()
  justificativa?: string;
}
