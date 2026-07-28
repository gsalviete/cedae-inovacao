import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  IsEmail,
  Equals,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIniciativaDto {
  /**
   * Ciência inequívoca do aviso de privacidade (LGPD), manifestada no checkbox
   * ao final do formulário. Obrigatoriamente `true`: a validação é repetida no
   * servidor para que a manifestação não possa ser contornada pelo cliente.
   * O aceite é registrado em INOVACAO_LOGS junto da submissão (ADR-008).
   */
  @Equals(true, {
    message:
      'É necessário confirmar a ciência do aviso de privacidade para enviar a proposta.',
  })
  ciencia_privacidade: boolean;

  // Bloco 0
  @IsString()
  @IsNotEmpty()
  nome_colaborador: string;

  @IsString()
  @IsNotEmpty()
  canal_contato: string;

  @IsEmail()
  @IsNotEmpty()
  email_proponente: string;

  // Bloco I
  @IsString()
  @IsNotEmpty()
  titulo_iniciativa: string;

  @IsString()
  @IsNotEmpty()
  area_proponente: string;

  @IsString()
  @IsNotEmpty()
  local_aplicacao: string;

  // Bloco II
  @IsString()
  @IsNotEmpty()
  problema_pratico: string;

  @IsOptional()
  @IsString()
  solucao_proposta?: string;

  @IsOptional()
  @IsString()
  risco_mitigado?: string;

  @IsOptional()
  @IsString()
  estagio_desenvolvimento?: string;

  // Bloco III
  @IsOptional()
  @IsString()
  macrodimensao?: string;

  /** Texto livre exibido quando macrodimensao === 'outros'. */
  @IsOptional()
  @IsString()
  macrodimensao_observacao?: string;

  @IsOptional()
  @IsString()
  perfil_impacto?: string;

  @IsOptional()
  @IsString()
  aporte_financeiro?: string;

  @IsOptional()
  @IsString()
  valor_aporte?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  retorno_economico?: number;

  // Bloco IV
  @IsOptional()
  @IsString()
  suporte_necessario?: string;

  @IsOptional()
  @IsString()
  diagnostico_observacao?: string;

  @IsOptional()
  @IsString()
  comentarios_adicionais?: string;
}
