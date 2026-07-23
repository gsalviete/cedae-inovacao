import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Edição de uma iniciativa já persistida, feita por ADM na tela de detalhes
 * (ADR-014 — edição administrativa). Todos os campos são opcionais: apenas os
 * enviados são atualizados. Campos estruturais (protocolo, canal, tipo de
 * proponente, status) NÃO são editáveis por aqui — status é do workflow.
 */
export class UpdateIniciativaDto {
  @IsOptional() @IsString() nome_colaborador?: string;
  @IsOptional() @IsString() canal_contato?: string;
  @IsOptional() @IsString() email_proponente?: string;

  @IsOptional() @IsString() titulo_iniciativa?: string;
  @IsOptional() @IsString() area_proponente?: string;
  @IsOptional() @IsString() local_aplicacao?: string;

  @IsOptional() @IsString() problema_pratico?: string;
  @IsOptional() @IsString() solucao_proposta?: string;
  @IsOptional() @IsString() risco_mitigado?: string;

  @IsOptional() @IsString() estagio_desenvolvimento?: string;
  @IsOptional() @IsString() macrodimensao?: string;
  @IsOptional() @IsString() macrodimensao_observacao?: string;
  @IsOptional() @IsString() perfil_impacto?: string;

  @IsOptional() @IsString() aporte_financeiro?: string;
  @IsOptional() @IsString() valor_aporte?: string;
  @IsOptional() @Type(() => Number) @IsNumber() retorno_economico?: number;

  @IsOptional() @IsString() suporte_necessario?: string;
  @IsOptional() @IsString() diagnostico_observacao?: string;
  @IsOptional() @IsString() comentarios_adicionais?: string;
}
