import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  IsEmail,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Cadastro manual autenticado (Vias 1, 3 e Captação Externa — ADR-013 §4.2-4.4).
 * Compartilha os campos da iniciativa com a Via 2; acrescenta o canal de origem
 * e os campos de procedência. O e-mail é opcional aqui (nem toda iniciativa
 * cadastrada por um analista tem e-mail do proponente disponível).
 * A validação cruzada de procedência (RN-03/RN-04) é feita no serviço.
 */
export class CreateManualIniciativaDto {
  // Origem
  @IsString()
  @IsIn(['VIA_1', 'VIA_3', 'MAPEAMENTO_EXTERNO'])
  canal_codigo: string;

  // Procedência — Via 1 (SGE/SGP)
  @IsOptional()
  @IsString()
  sistema_origem?: string;

  @IsOptional()
  @IsString()
  codigo_origem?: string;

  // Procedência — Captação Externa
  @IsOptional()
  @IsString()
  organizacao_externa?: string;

  @IsOptional()
  @IsString()
  tipo_instituicao?: string;

  // Procedência — Via 3 (reunião), preservada como observação inicial
  @IsOptional()
  @IsString()
  data_reuniao?: string;

  @IsOptional()
  @IsString()
  area_reuniao?: string;

  // Bloco 0
  @IsString()
  @IsNotEmpty()
  nome_colaborador: string;

  @IsString()
  @IsNotEmpty()
  canal_contato: string;

  @IsOptional()
  @IsEmail()
  email_proponente?: string;

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
